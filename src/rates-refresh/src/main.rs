//! Fetch the ECB daily FX snapshot and write a rates.json atomically.
//! No runtime deps: std only. Network is optional; the plugin ships a snapshot.

use std::env;
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

const ECB_URL: &str = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const DEFAULT_TIMEOUT: u64 = 5;

fn main() {
    let mut args = env::args().skip(1);
    let cmd = args.next().unwrap_or_else(|| "help".into());
    match cmd.as_str() {
        "fetch" => {
            let mut out: Option<PathBuf> = None;
            let mut timeout = DEFAULT_TIMEOUT;
            while let Some(a) = args.next() {
                if a == "--out" {
                    out = args.next().map(PathBuf::from);
                } else if a == "--timeout" {
                    timeout = args
                        .next()
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(DEFAULT_TIMEOUT);
                } else if a == "--xml" {
                    let xml_path = args.next().expect("--xml needs a path");
                    let xml = fs::read_to_string(xml_path).expect("read xml");
                    match parse_ecb(&xml) {
                        Ok(json) => print_or_write(out.as_deref(), &json),
                        Err(e) => {
                            eprintln!("notepad-calc-rates: parse: {e}");
                            std::process::exit(2);
                        }
                    }
                    return;
                }
            }
            let dest = out.unwrap_or_else(|| PathBuf::from("rates.json"));
            match fetch_and_write(&dest, timeout) {
                Ok(date) => {
                    println!("ok {date}");
                }
                Err(e) => {
                    eprintln!("notepad-calc-rates: {e}");
                    std::process::exit(1);
                }
            }
        }
        "parse" => {
            let mut buf = String::new();
            io::stdin().read_to_string(&mut buf).ok();
            match parse_ecb(&buf) {
                Ok(json) => {
                    print!("{json}");
                }
                Err(e) => {
                    eprintln!("notepad-calc-rates: parse: {e}");
                    std::process::exit(2);
                }
            }
        }
        "ping" => println!("ok"),
        _ => {
            eprintln!(
                "usage: notepad-calc-rates fetch --out PATH [--timeout 5]\n       notepad-calc-rates parse < xml"
            );
            std::process::exit(if cmd == "help" { 0 } else { 2 });
        }
    }
}

fn fetch_and_write(dest: &Path, timeout_s: u64) -> Result<String, String> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir: {e}"))?;
    }
    let xml = curl_get(ECB_URL, timeout_s)?;
    let json = parse_ecb(&xml)?;
    atomic_write(dest, json.as_bytes())?;
    let date = json
        .split("\"date\": \"")
        .nth(1)
        .and_then(|s| s.split('"').next())
        .unwrap_or("unknown")
        .to_string();
    Ok(date)
}

fn curl_get(url: &str, timeout_s: u64) -> Result<String, String> {
    let child = Command::new("curl")
        .args([
            "-fsSL",
            "--max-time",
            &timeout_s.to_string(),
            "--retry",
            "0",
            url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("curl spawn: {e}"))?;

    let _ = Duration::from_secs(timeout_s);
    let out = child
        .wait_with_output()
        .map_err(|e| format!("curl wait: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "curl exit {}: {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    String::from_utf8(out.stdout).map_err(|e| format!("utf8: {e}"))
}

fn atomic_write(dest: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = dest.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("create tmp: {e}"))?;
        f.write_all(bytes).map_err(|e| format!("write tmp: {e}"))?;
        f.sync_all().ok();
    }
    fs::rename(&tmp, dest).map_err(|e| format!("rename: {e}"))
}

fn print_or_write(dest: Option<&Path>, json: &str) {
    if let Some(p) = dest {
        if let Some(parent) = p.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Err(e) = atomic_write(p, json.as_bytes()) {
            eprintln!("notepad-calc-rates: {e}");
            std::process::exit(1);
        }
    } else {
        print!("{json}");
    }
}

/// Pull `time="YYYY-MM-DD"` and `currency="USD" rate="1.16"` cubes out of the
/// ECB daily XML. Intentionally not a general XML parser.
pub fn parse_ecb(xml: &str) -> Result<String, String> {
    let date = attr_after(xml, "time=\"").ok_or_else(|| "no time= date in ECB xml".to_string())?;
    if date.len() != 10 || !date.as_bytes()[0].is_ascii_digit() {
        return Err(format!("bad date {date}"));
    }
    let mut rates: Vec<(String, String)> = Vec::new();
    let mut rest = xml;
    while let Some(code) = attr_after(rest, "currency=\"") {
        let idx = rest.find("currency=\"").unwrap_or(0);
        rest = &rest[idx + 10 + code.len()..];
        let rate = attr_after(rest, "rate=\"").ok_or_else(|| format!("no rate for {code}"))?;
        if !code.chars().all(|c| c.is_ascii_uppercase()) || code.len() != 3 {
            continue;
        }
        if rate.parse::<f64>().ok().filter(|n| *n > 0.0).is_none() {
            continue;
        }
        rates.push((code, rate));
    }
    if rates.is_empty() {
        return Err("no currency cubes".into());
    }
    let mut out = String::from("{\n");
    out.push_str(&format!("  \"date\": \"{date}\",\n"));
    out.push_str("  \"base\": \"EUR\",\n");
    out.push_str("  \"source\": \"ECB daily reference\",\n");
    out.push_str("  \"rates\": {\n");
    for (i, (code, rate)) in rates.iter().enumerate() {
        let comma = if i + 1 == rates.len() { "" } else { "," };
        out.push_str(&format!("    \"{code}\": {rate}{comma}\n"));
    }
    out.push_str("  }\n}\n");
    Ok(out)
}

fn attr_after(s: &str, key: &str) -> Option<String> {
    let i = s.find(key)?;
    let rest = &s[i + key.len()..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"
<gesmes:Envelope>
  <Cube>
    <Cube time="2026-08-18">
      <Cube currency="USD" rate="1.1600"/>
      <Cube currency="GBP" rate="0.8620"/>
      <Cube currency="JPY" rate="170.25"/>
    </Cube>
  </Cube>
</gesmes:Envelope>
"#;

    #[test]
    fn parses_ecb_cubes() {
        let json = parse_ecb(SAMPLE).unwrap();
        assert!(json.contains("\"date\": \"2026-08-18\""));
        assert!(json.contains("\"USD\": 1.1600"));
        assert!(json.contains("\"GBP\": 0.8620"));
        assert!(json.contains("\"base\": \"EUR\""));
    }

    #[test]
    fn rejects_empty() {
        assert!(parse_ecb("<cube/>").is_err());
    }

    #[test]
    fn rejects_date_without_currencies() {
        let xml = r#"<Cube time="2026-08-18"></Cube>"#;
        assert!(parse_ecb(xml).unwrap_err().contains("no currency cubes"));
    }
}
