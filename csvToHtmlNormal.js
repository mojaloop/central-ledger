const fs = require('fs');
const csv = require('csv-parser');

function csvToHtml(csvFile, htmlFile) {
    const results = [];
    const fieldsToSkip=['vcs','issueTracker','website','purl','bom_ref','description','algorithm','hash_text'];
    
    fs.createReadStream(csvFile)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            const headers = Object.keys(results[0]);
            let htmlContent ='<html>\n';
            htmlContent += `<head>\n<style>
                                /* CSS styles for the table */
                                h1 {
                                    font-family: Arial, sans-serif;
                                    background-color: #f0f4f8;
                                    color: #0073e6;
                                    margin: 0;
                                    padding: 0;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    justify-content: center;
                                }

                                table {
                                    width: 100%;
                                    border-collapse: collapse;
                                    margin-bottom: 20px;
                                    font-size: 14px; /* Adjust font size */
                                }

                                table, th, td {
                                    border: 1px solid #ddd;
                                    padding: 6px; /* Reduce padding */
                                    text-align: left;
                                }

                                th {
                                    background-color: #f2f2f2;
                                    color: #000;
                                    background-color: #004080; /* Navy blue background for header */
                                    color: #fff; /* White text for header */
                                }

                                td {
                                    white-space: nowrap; /* Prevent wrapping by default */
                                }

                                td.name {
                                    white-space: normal; /* Allow wrapping for 'Name' field */
                                    max-width: 150px; /* Limit maximum width */
                                }

                                tr:nth-child(even) {
                                    background-color: #f9f9f9;
                                }

                                tr:hover {
                                    background-color: #e6f2ff; /* Light blue on hover */
                                }

                                caption {
                                    font-size: 16px;
                                    font-weight: bold;
                                    margin-bottom: 10px;
                                }

                            </style>\n</head>\n`;
            let htmlFileName = htmlFile.split('.');
            htmlContent += `<h1>SBOM ${htmlFileName[0]}</h1>\n`;
            htmlContent += '<table border="1">\n';
            htmlContent += '  <thead>\n    <tr>\n';
            
            headers.forEach(header => {
                if(!fieldsToSkip.includes(header)){
                    htmlContent += `      <th>${header}</th>\n`;
                }
            });
            
            htmlContent += '    </tr>\n  </thead>\n  <tbody>\n';
            
            results.forEach(row => {
                htmlContent += '    <tr>\n';
                headers.forEach(header => {
                    if(!fieldsToSkip.includes(header)){
                        htmlContent += `      <td>${row[header]}</td>\n`;
                    }
                });
                htmlContent += '    </tr>\n';
            });
            
            htmlContent += '  </tbody>\n</table>\n</html>\n';
            
            fs.writeFile(htmlFile, htmlContent, (err) => {
                if (err) throw err;
                console.log(`HTML table has been saved to ${htmlFile}`);
            });
        });
}

// Example usage
csvToHtml('metadata-last-publish.csv', 'metadata-normal.html');
csvToHtml('components-last-publish.csv', 'components-normal.html');
