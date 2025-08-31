# Get list of files from VPS
ssh justin@slipbox "ls -1 ~/apps/slipbox/data" | sort > vps_files.txt

# Get list of local files
ls -1 ~/slipbox | sort > local_files.txt

# Compare to see what's only on VPS
diff local_files.txt vps_files.txt | grep "^>" | sed 's/^> //'
