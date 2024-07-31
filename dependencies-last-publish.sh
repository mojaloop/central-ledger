#!/bin/bash

# Define the file names
input_file="dependencies.csv"
output_file="dependencies-last-publish.csv"

# Check if the input file exists
if [ ! -f "$input_file" ]; then
    echo "Input file not found!"
    exit 1
fi

# Clear the output file if it exists, or create a new one
> "$output_file"


echo "dependency,last publish details" >> "$output_file"

IFS= read -r header < "$input_file"
# Read the input file line by line
while IFS= read -r line; do
    echo "Processing: $line"
    IFS='|' read -r -a array <<< "$line"
    line=${array[-1]}
    
    # Run the npm view command and capture the output
    npm_output=$(npm view "$line" 2>/dev/null)
    
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
