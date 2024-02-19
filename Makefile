%.html: %.md before Makefile
	pandoc -s --css basic.css -f markdown -B before -o $@ $<

.PHONY: all
all: $(patsubst %.md,%.html,$(wildcard *.md))

