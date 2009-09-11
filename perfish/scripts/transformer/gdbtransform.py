import os.path

from genshi.template import NewTextTemplate

import gdb

def _get_scripts_dir():
    file_path = os.path.abspath(__file__)
    transform_dir = os.path.split(file_path)[0]
    scripts_dir = os.path.split(transform_dir)[0]
    return scripts_dir

def chew_script(script_name):
    '''
    Given just a script name, figure out the appropriate input path and
    output path and call process_script.
    '''
    scripts_dir = _get_scripts_dir()
    input_path = os.path.join(scripts_dir, 'src', script_name)
    output_path = os.path.join(scripts_dir, 'processed', script_name)

    print 'in', input_path, 'out', output_path
    process_script(input_path, output_path)
    print 'done'

def process_script(input_path, output_path):
    '''
    Given an input path, pass the script through genshi with the current gdb
    context, writing it to the given output path.
    '''
    input_script = open(input_path, 'rt')
    tmpl = NewTextTemplate(input_script)
    stream = tmpl.generate(gdb=gdb)
    
    output_script = open(output_path, 'wt')
    output_script.write(stream.render())
    output_script.close()
    input_script.close()

class ChewScriptCommand(gdb.Command):
    def __init__(self):
        gdb.Command.__init__(self, "chew", gdb.COMMAND_NONE)

    def invoke(self, arg, from_tty):
        chew_script(arg)

ChewScriptCommand()
