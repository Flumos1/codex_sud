import { readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const [input, output] = process.argv.slice(2);

if (!input || !output) {
  console.error("Usage: node scripts/extract-pdf-text.mjs <input.pdf> <output.txt>");
  process.exit(1);
}

const pdf = await readFile(input);
const source = pdf.toString("latin1");
const fontToUnicode = buildFontMaps(source);
const fontNameToObject = buildPageFontResources(source);
const text = extractText(source, fontToUnicode, fontNameToObject)
  .replace(/[ \t]+/g, " ")
  .replace(/\n\s+/g, "\n")
  .trim();

await writeFile(output, `${text}\n`, "utf8");
console.log(`Wrote ${output}`);

function buildFontMaps(pdfSource) {
  const maps = {};
  const fontRegex = /(\d+) 0 obj\s*<<[\s\S]*?\/ToUnicode\s+(\d+)\s+0\s+R[\s\S]*?>>/g;

  for (const match of pdfSource.matchAll(fontRegex)) {
    maps[match[1]] = parseCMap(getStreamFromObject(pdfSource, match[2]));
  }

  return maps;
}

function buildPageFontResources(pdfSource) {
  const resourceObject = getObject(pdfSource, "9") || "";
  const result = {};

  for (const match of resourceObject.matchAll(/\/(R\d+)\s+(\d+)\s+0\s+R/g)) {
    result[match[1]] = match[2];
  }

  return result;
}

function extractText(pdfSource, fontToUnicode, fontNameToObject) {
  let text = "";
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;

  for (const match of pdfSource.matchAll(streamRegex)) {
    let stream;
    try {
      stream = inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }

    if (!/\bBT\b/.test(stream) || /begincmap/.test(stream)) {
      continue;
    }

    text += extractContentStreamText(stream, fontToUnicode, fontNameToObject);
    text += "\n";
  }

  return text;
}

function extractContentStreamText(stream, fontToUnicode, fontNameToObject) {
  const tokens =
    stream.match(/\/(R\d+)\s+[0-9.]+\s+Tf|\((?:\\.|[^\\)])*\)|<([0-9A-Fa-f\s]+)>|\]|\[/g) || [];
  let currentFont = "R10";
  let inArray = false;
  let text = "";

  for (const token of tokens) {
    const fontMatch = token.match(/^\/(R\d+)/);
    if (fontMatch) {
      currentFont = fontMatch[1];
      continue;
    }

    if (token === "[") {
      inArray = true;
      continue;
    }

    if (token === "]") {
      inArray = false;
      text += " ";
      continue;
    }

    if (token.startsWith("(") || (token.startsWith("<") && !token.startsWith("<<"))) {
      text += decodeBytes(extractStringBytes(token), currentFont, fontToUnicode, fontNameToObject);
      if (!inArray) {
        text += " ";
      }
    }
  }

  return text;
}

function getObject(pdfSource, objectId) {
  const regex = new RegExp(`${objectId} 0 obj\\s*([\\s\\S]*?)\\s*endobj`);
  const match = pdfSource.match(regex);
  return match?.[1] || "";
}

function getStreamFromObject(pdfSource, objectId) {
  const object = getObject(pdfSource, objectId);
  const match = object.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
  if (!match) {
    return "";
  }

  const buffer = Buffer.from(match[1], "latin1");
  return /FlateDecode/.test(object) ? inflateSync(buffer).toString("latin1") : buffer.toString("latin1");
}

function parseCMap(text) {
  const map = {};

  for (const line of text.split(/\r?\n/).map((value) => value.trim())) {
    let match = line.match(/^<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>$/);
    if (match) {
      const start = Number.parseInt(match[1], 16);
      const end = Number.parseInt(match[2], 16);
      const destination = Number.parseInt(match[3], 16);
      for (let code = start; code <= end; code += 1) {
        map[code] = String.fromCodePoint(destination + (code - start));
      }
      continue;
    }

    match = line.match(/^<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>$/);
    if (match) {
      map[Number.parseInt(match[1], 16)] = String.fromCodePoint(Number.parseInt(match[2], 16));
    }
  }

  return map;
}

function extractStringBytes(token) {
  if (token.startsWith("(")) {
    return unescapeLiteral(token.slice(1, -1));
  }

  const hex = token.slice(1, -1).replace(/\s+/g, "");
  const bytes = [];
  for (let index = 0; index < hex.length; index += 2) {
    bytes.push(Number.parseInt(hex.slice(index, index + 2), 16));
  }
  return bytes;
}

function unescapeLiteral(value) {
  const bytes = [];

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char !== "\\") {
      bytes.push(char.charCodeAt(0));
      continue;
    }

    const next = value[++index];
    if (next === "n") bytes.push(10);
    else if (next === "r") bytes.push(13);
    else if (next === "t") bytes.push(9);
    else if (next === "b") bytes.push(8);
    else if (next === "f") bytes.push(12);
    else if (/[0-7]/.test(next || "")) {
      let octal = next;
      for (let count = 0; count < 2 && /[0-7]/.test(value[index + 1] || ""); count += 1) {
        octal += value[++index];
      }
      bytes.push(Number.parseInt(octal, 8));
    } else {
      bytes.push((next || "").charCodeAt(0));
    }
  }

  return bytes;
}

function decodeBytes(bytes, fontName, fontToUnicode, fontNameToObject) {
  const fontObject = fontNameToObject[fontName];
  const cmap = fontToUnicode[fontObject] || {};
  const usesWideCodes = Object.keys(cmap).some((key) => Number(key) > 255);
  const chars = [];

  if (usesWideCodes) {
    for (let index = 0; index < bytes.length; index += 2) {
      const code = ((bytes[index] || 0) << 8) | (bytes[index + 1] || 0);
      chars.push(cmap[code] ?? (code >= 32 && code < 127 ? String.fromCharCode(code) : ""));
    }
    return chars.join("");
  }

  for (const byte of bytes) {
    chars.push(cmap[byte] ?? (byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ""));
  }

  return chars.join("");
}
