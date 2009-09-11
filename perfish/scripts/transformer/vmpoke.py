import gdb

class VMPokeCommand(gdb.Command):
    '''
    This is useless and does nothing right now.  The issue is that
    "info threads" currently requires human interaction or automated
    interaction that I do not believe gdbpython is capable of right
    now.  (Owing to the need to grok the output from "info threads").
    '''
    def __init__(self):
        gdb.Command.__init__(self, "vmpoke", gdb.COMMAND_NONE)

    def invoke(self, arg, from_tty):
        args = arg.split(' ')
        host = args[0]
        port = int(args[1])
        gdb.execute('target remote %s:%d' % (host, port))

        inferior = gdb.inferiors[0]
        for thread in inferior.threads:
            pass
