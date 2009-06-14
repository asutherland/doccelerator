
sys.include_path.push('../../jshydra/utils');

include("dumpast.js");
include("cleanast.js");
include("comments.js");
include("jstypes.js");

const KNOWN_PATH_ROOTS = {
  "comm-central": {
  },
  "mozilla-central": {
  },
};

/**
 * Dubious logic to normalize an absolute path to a repository-normalized path.
 * The right thing to do is likely to walk from most-specific to least-specific
 * looking for revision control indicators (.hg/.git) and using that (both to
 * know the root of the repo as well as its true name, rather than what the user
 * named it.)
 */
function normalize_path(path) {
  for each (let [repo_name, sub_repos] in Iterator(KNOWN_PATH_ROOTS)) {
    let idx_repo = path.indexOf(repo_name + "/");
    if (idx_repo != -1)
      return path.substring(idx_repo);
  }

  return path;
}

var NodeUtils = {
  references: function NodeUtils_references(aNode, aTypeString) {
    if (aNode.references === undefined)
      aNode.references = {};
    aNode.references[aTypeString] = null;
  },
};

function make_node(aOot, aType, aInfo, aName, aParent) {
  let node = {
    file: aOot.filename,
    type: aType,
    name: aName,
    explicitName: aInfo.name ? aInfo.name : null,
    fullName: aParent ? aParent.fullName + "." + aName : aName,
    parentName: aParent ? aParent.fullName : null,
  };

  if (aInfo.comment)
    parse_comment(aInfo.comment, node);

  aOot.docs.push(node);
  return node;
}

var BlockParsers = {
  para: function BlockParser_para(aBlock, aNode) {
    aBlock.stream = parse_comment_text(aBlock.text, aNode);
  },
  bullet: function BlockParser_bullet(aBlock, aNode) {
    aBlock.stream = parse_comment_text(aBlock.text, aNode);
  },
  tag: function BlockParser_tag(aBlock, aNode) {
    if (aBlock.tag in TagParsers)
      TagParsers[aBlock.tag](aBlock, aNode);
    else
      aBlock.stream = parse_comment_text(aBlock.text, aNode);
  },
};

var TagParsers = {
  _paramReturnCommon: function TagParser_paramReturnCommon(aText, aResObj,
                                                           aBlock, aNode) {
    // next there may be an optional type
    if (aText[0] == '{') {
      let idxRBrace = aText.indexOf('}');
      if (idxRBrace) {
        aResObj.type = aText.substring(1, idxRBrace);
        aText = aText.substring(idxRBrace + 1).trimLeft();
      }
    }

    aResObj.stream = parse_comment_text(aText);
  },
  param: function TagParser_param(aBlock, aNode) {
    if (aNode.params === undefined)
      aNode.params = [];
    let param = {};
    aNode.params.push(param);

    let text = aBlock.text;

    // the first thing should be the parameter name...
    {
      let idxSpace = text.indexOf(" ");
      if (idxSpace == -1)
        idxSpace = text.length;
      param.name = text.substring(0, idxSpace);
      text = text.substring(idxSpace+1).trimLeft();
    }

    this._paramReturnCommon(text, param, aBlock, aNode);
  },
  returns: function TagParser_param(aBlock, aNode) {
    aNode.returns = {};

    this._paramReturnCommon(aBlock.text, aNode.returns, aBlock, aNode);
  }
};

const REFERENCE_REGEX = /\|([^|]+)\|/g;
function parse_comment_text(aText, aNode) {
  let match;

  let stream = [];

  let curIndex = 0;
  while ((match = REFERENCE_REGEX.exec(aText)) != null) {
    if (match.index > curIndex)
      stream.push(aText.substring(curIndex, match.index));
    stream.push({type: "reference", reference: match[1]});
    NodeUtils.references(aNode, match[1]);
    curIndex = REFERENCE_REGEX.lastIndex;
  }
  if (curIndex < aText.length)
    stream.push(aText.substring(curIndex));

  return stream;
}

/**
 * Our parsing is a multi-pass stream thing.  We walk through, noting when we
 *  see a paragraph boundary, tag, or bullet.  For each of these things, we use
 *  parse_comment_text to process it to detect references or other forms of
 *  inline markup, although it's really up to the parser.
 */
function parse_comment(aComment, aNode) {
  let iStart = aComment.lastIndexOf("/**");
  if (iStart == -1)
    return;
  let iEnd = aComment.indexOf("*/", iStart);
  let cstr = aComment.substring(iStart + 2, iEnd).trimRight();
  let lines = cstr.split(/\n\r?/g);

  let blockStream = [];
  let curBlock = null;
  let lastIndent = -1;

  function finishBlock() {
    if (curBlock == null)
      return;
    if (!(curBlock.type in BlockParsers))
      throw new Error("Illegal block type: " + curBlock.type);

    BlockParsers[curBlock.type](curBlock, aNode);
    curBlock = null;
  }

  for each (let [, line] in Iterator(lines)) {
    if (line[0] == "*")
      line = line.substring(1);

    let curIndent = -1;
    for (let i = 0; i < line.length; i++) {
      if (line[i] != " ") {
        curIndent = i - 1;
        line = line.substring(i);
        break;
      }
    }


    // blank line
    if (curIndent == -1) {
      finishBlock();
      curBlock = null;
    }
    // bullet
    else if (line[0] == "-") {
      curBlock = {type: "bullet", text: line.substring(1).trimLeft() };
      blockStream.push(curBlock);
    }
    // some tag thing
    else if (line[0] == "@") {
      let idxEndTag = line.indexOf(" ");
      curBlock = {type: "tag", tag: line.substring(1, idxEndTag),
                  text: line.substring(idxEndTag+1).trimLeft() };
      blockStream.push(curBlock);
    }
    // continuation of the block
    else if (lastIndent != -1 && curIndent >= lastIndent) {
      curBlock.text += " " + line;
    }
    // paragraph; new or implied by outdenting (asuth style)
    else {
      finishBlock();
      curBlock = {type: "para", text: line};
      blockStream.push(curBlock);
    }

    lastIndent = curIndent;
  }
  finishBlock();

  aNode.docStream = blockStream;
}

/**
 * Resolve all references to absolute references.  Walk each node and see if
 *  any of its references are satisfied by the local names of its ancestors.
 *  If so, update the reference appropriately.
 */
function fixup_references(aNodes) {
  let fullNameToNodes = {};

  for each (let [, node] in Iterator(aNodes)) {
    fullNameToNodes[node.fullName] = node;
  }

  function resolveReference(aNode, aReference) {
    let relativized = aNode.fullName + "." + aReference;
    if (relativized in fullNameToNodes)
      return relativized;
    if (aNode.parentName)
      return resolveReference(fullNameToNodes[aNode.parentName], aReference);
    return aReference;
  }

  for each (let [, node] in Iterator(aNodes)) {
    if (!node.references)
      continue;
    for each (let refName in Iterator(node.references, true)) {
      node.references[refName] = resolveReference(node, refName);
    }
  }
}

function process_js(ast, f) {
  let oot = {
    filename: normalize_path(f),
    docs: [],
  };

  let toplevel = clean_ast(ast);
  associate_comments(f, toplevel);
  for each (let v in toplevel.variables) {
    let node = make_node(oot, "global", v, v.name);
    node.constant = false;
  }
  for each (let v in toplevel.constants) {
    let node = make_node(oot, "global", v, v.name);
    node.constant = true;
  }
  for each (let v in toplevel.objects.concat(toplevel.classes)) {
    divine_inheritance(v, toplevel.constants);
    let classNode = make_node(oot, "class", v, v.name);
    classNode.subclasses = v.inherits;
    for each (let [name, cv] in Iterator(v.functions)) {
      let methNode = make_node(oot, "method", cv, name, classNode);
    }
    for each (let [name, cv] in Iterator(v.variables)) {
      let methNode = make_node(oot, "field", cv, name, classNode);
    }
    for each (let [name, cv] in Iterator(v.getters)) {
      let methNode = make_node(oot, "getter", cv, name, classNode);
    }
    for each (let [name, cv] in Iterator(v.setters)) {
      let methNode = make_node(oot, "setter", cv, name, classNode);
    }
  }
  for each (let v in toplevel.functions) {
    let node = make_node(oot, "function", v, v.name);
  }

  fixup_references(oot.docs);
  _print(JSON.stringify(oot));
}