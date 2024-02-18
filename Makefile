%.html: %.md
	pandoc --css basic.css -f markdown -o $@ $<

.PHONY: all
all: $(patsubst %.md,%.html,$(wildcard *.md))

