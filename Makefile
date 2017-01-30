tarball:
	tar cvf sources.tar $(shell git ls-tree  --name-only HEAD)
clean:
	rm -rf sources.tar target/
