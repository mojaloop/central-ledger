git clone https://github.com/mojaloop/ml-depcheck-utility.git ./tmp/ml-depcheck-utility

cd tmp/ml-depcheck-utility  

npm install     

cd ../../

bash tmp/ml-depcheck-utility/src/individual-repo/npm/generate-sbom.sh
