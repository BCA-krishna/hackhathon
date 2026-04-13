const { parse } = require('csv-parse/sync');

function parseCsvBuffer(buffer) {
  const content = buffer.toString('utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
}

module.exports = { parseCsvBuffer };
