'''
Take a JSON list of PCs provided by pcextractor.py and figure out what
functions those PCs belong to, if any.  Our output is a JSON dictionary
mapping PCs (hex-style) to their function names
'''

import json, os.path

import gdb

# gdb.block_for_pc(0x400ab4bc).function => "symbol for js_Interpret"
# gdb.block_for_pc(0x400ab4bc).function.name => "js_Interpret"
# function.symtab.filename is the file...

# block also has, start, end, superblock

def lookup_pcs(inpath):
    inbase, inext = os.path.splitext(inpath)
    outpath = inbase + '-mapped' + inext
    fin = open(inpath, 'rt')
    pc_list = json.load(fin)
    fin.close()

    pc_map = {}
    for pc in pc_list:
        block = gdb.block_for_pc(pc)
        if block is None:
            continue
        func = block.function
        if block.function is None:
            continue
        pc_map[hex(pc)] = [func.symtab.filename, func.name]

    fout = open(outpath, 'wt')
    json.dump(pc_map, fout, indent=2)
    fout.close()

class PCLookupCommand(gdb.Command):
    def __init__(self):
        gdb.Command.__init__(self, "pclookup", gdb.COMMAND_NONE)

    def invoke(self, arg, from_tty):
        lookup_pcs(arg)

PCLookupCommand()
