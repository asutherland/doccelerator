'''
Chew jsstack.emt output, looking for lines of the form: "C stack: GUEST_" and
extracting the addresses.  Consolidate those and spit them out so that
gdbpclookup.py can map them for us.
'''
import json

class PCScraper(object):
    def __init__(self):
        self.known_addresses = set()

    def scrapeFile(self, path):
        startString = 'C stack: GUEST_'

        known_addresses = self.known_addresses

        f = open(path, 'rt')
        for line in f:
            if not line.startswith(startString):
                continue
            addr_parts = line[len(startString):].split('_')
            # eliminate any partial addresses due to vprobe limits
            if '...' in addr_parts[-1]:
                addr_parts.pop()
            addresses = map(lambda x: int(x, 16), addr_parts)
            for addr in addresses:
                # ignore obviously bogus PCs
                if addr < 4096:
                    continue
                known_addresses.add(addr)

        f.close()

    def dumpKnownAddresses(self, outpath):
        f = open(outpath, 'w')
        json.dump(list(self.known_addresses), f, indent=2)
        f.close()


if __name__ == '__main__':
    import sys

    if len(sys.argv) < 3:
        print 'You need to provide the input file name and output file name!'
        sys.exit(1)

    scraper = PCScraper()
    scraper.scrapeFile(sys.argv[1])
    scraper.dumpKnownAddresses(sys.argv[2])
