const fs = require('fs');
const csv = require('csv-parser');

function csvToHtml(csvFile, htmlFile) {
    const results = [];
    
    fs.createReadStream(csvFile)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            const headers = Object.keys(results[0]);
            let htmlContent ='<html>\n';
            htmlContent += '<table border="1">\n';
            htmlContent += '  <thead>\n    <tr>\n';
            
            headers.forEach(header => {
                htmlContent += `      <th>${header}</th>\n`;
            });
            
            htmlContent += '    </tr>\n  </thead>\n  <tbody>\n';
            
            results.forEach(row => {
                htmlContent += '    <tr>\n';
                headers.forEach(header => {
                    htmlContent += `      <td>${row[header]}</td>\n`;
                });
                htmlContent += '    </tr>\n';
            });
            
            htmlContent += '  </tbody>\n</table>\n</html>\n';
            
            fs.writeFile(htmlFile, htmlContent, (err) => {
                if (err) throw err;
                console.log('HTML table has been saved to ${htmlFile}');
            });
        });
}

// Example usage
csvToHtml('metadata.csv', 'metadata-detailed.html');
csvToHtml('components.csv', 'components-detailed.html');
csvToHtml('dependencies.csv', 'dependencies-detailed.html');