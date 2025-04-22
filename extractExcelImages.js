const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const EXCEL_FILE = 'PL- ARPER.xlsx';
const OUTPUT_DIR = 'excel_extracted_images';

async function main() {
  // Step 1: Unzip the Excel file
  const zip = new AdmZip(EXCEL_FILE);
  const zipEntries = zip.getEntries();

  // Step 2: Extract all images from xl/media
  const mediaDir = path.join(OUTPUT_DIR, 'media');
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  let imageFiles = [];
  zipEntries.forEach(entry => {
    if (entry.entryName.startsWith('xl/media/')) {
      const imgName = path.basename(entry.entryName);
      const outPath = path.join(mediaDir, imgName);
      fs.writeFileSync(outPath, entry.getData());
      imageFiles.push(imgName);
    }
  });
  console.log('Extracted images:', imageFiles);

  // Step 3: Parse drawing1.xml to map images to cell anchors
  const drawingEntry = zipEntries.find(e => e.entryName === 'xl/drawings/drawing1.xml');
  if (!drawingEntry) {
    console.error('drawing1.xml not found!');
    return;
  }
  const drawingXml = drawingEntry.getData().toString();
  const drawingJson = await xml2js.parseStringPromise(drawingXml);

  // Step 4: Parse relationships to map rId to image file
  const relsEntry = zipEntries.find(e => e.entryName === 'xl/drawings/_rels/drawing1.xml.rels');
  if (!relsEntry) {
    console.error('drawing1.xml.rels not found!');
    return;
  }
  const relsXml = relsEntry.getData().toString();
  const relsJson = await xml2js.parseStringPromise(relsXml);
  const relsMap = {};
  if (relsJson.Relationships && relsJson.Relationships.Relationship) {
    relsJson.Relationships.Relationship.forEach(rel => {
      if (rel.$.Type.includes('/image')) {
        relsMap[rel.$.Id] = path.basename(rel.$.Target);
      }
    });
  }

  // Step 5: Map images to cells (row/col)
  let imageCellMap = [];
  const anchors = drawingJson['xdr:wsDr']['xdr:oneCellAnchor'] || [];
  anchors.forEach(anchor => {
    const pic = anchor['xdr:pic'] && anchor['xdr:pic'][0];
    if (pic && pic['xdr:blipFill']) {
      const blip = pic['xdr:blipFill'][0]['a:blip'][0].$;
      const embed = blip['r:embed'];
      const imgFile = relsMap[embed];
      const from = anchor['xdr:from'][0];
      const row = parseInt(from['xdr:row'][0], 10) + 1; // 0-based to 1-based
      const col = parseInt(from['xdr:col'][0], 10) + 1; // 0-based to 1-based
      imageCellMap.push({ imgFile, row, col });
    }
  });
  console.log('Image to cell mapping:', imageCellMap);

  // Step 6: Output mapping to JSON
  fs.writeFileSync(path.join(OUTPUT_DIR, 'image_cell_map.json'), JSON.stringify(imageCellMap, null, 2));
  console.log('Mapping saved to', path.join(OUTPUT_DIR, 'image_cell_map.json'));
}

main().catch(console.error);
