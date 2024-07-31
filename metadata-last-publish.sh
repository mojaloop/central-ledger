input_file="metadata.csv"
output_file="metadata-last-publish.csv"

#adds a new line to the output file so that even last line is read 
echo >> "$input_file"

if [ ! -f "$input_file" ]; then
    echo "Input file not found"
    exit 1
fi

> "$output_file" 

echo "timestamp,tool_vendor,tool_name,tool_version,type,bom_ref,author,group,name,version,description,license_id,purl,website,issueTracker,vcs,publish_details" >> "$output_file"

IFS= read -r header < "$input_file"
# Read the input file line by line
while IFS= read -r line; do
    echo "Processing: $line"

    IFS=',' read -r -a array <<< "$line"
    bom_ref=${array[5]}
    echo "$bom_ref"

    IFS='|' read -r -a array <<< "$line"
    line=${array[-1]}
    
    # Run the npm view command and capture the output
    npm_output=$(npm view "$bom_ref" 2>/dev/null)
    
    # Check if npm view command was successful
    if [ $? -eq 0 ]; then
        # Get the last line of the npm view output
        last_line=$(echo "$npm_output" | tail -n 1)
        
        # Save the last line to the output file
        echo "$line,$last_line" >> "$output_file"
    else
        echo "$line,Impossible" >> "$output_file"
    fi
done < <(tail -n +2 "$input_file")

echo "Processing completed. Check the output in $output_file"
