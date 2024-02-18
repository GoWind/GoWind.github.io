#!/usr/bin/env bash
find . -maxdepth 1 -type f -name "*.md" -print
# pandoc -s -f markdown --css pandoc.css {} -o {}.html
find . -maxdepth 1 -type f -name "*.md" -print0 | xargs -0 -I {} sh -c 'pandoc --quiet -s --css basic.css -f markdown  -o $(echo {} | sed "s/\.md$/.html/") {}'
# find . -type f -name "*.md" -print | xargs  -I {} sh -c "echo '{}'

