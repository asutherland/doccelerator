
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

/**
 * Helper function to process a documentation node.
 *
 * @param aOot Root result element.  We will place our constructed node in
 *     aOot.docs.
 * @param {String} aType the type of node.
 * @param aInfo The jshydra object we are consuming.
 * @param aName The name of the object as provided by context.  This is
 *     generally what we would think of as the name, rather than the explicit
 *     name potentially provided (or not) with a function, for example.  In
 *     the case "var a = function b() {}", aName is "a".
 * @param aParent The parent node produced by a previous call to make_node.
 *
 * @returns The node object built by this method.
 */
function make_node(aOot, aType, aInfo, aName, aParent) {
  let node = {
    file: aOot.filename,
    type: aType,
    name: aName,
    explicitName: aInfo.name ? aInfo.name : null,
    fullName: aParent ? aParent.fullName + "." + aName : aName,
    parentName: aParent ? aParent.fullName : null,
    visibilityDescription: null,
  };

  let comment;
  // If this is a class, the comment may be on our constructor.
  if (aInfo.constructor && aInfo.constructor.comment)
    comment = aInfo.constructor.comment;
  if (aInfo.comment)
    comment = comment ? (comment + aInfo.comment) : aInfo.comment;
  if (comment)
    parse_comment(comment, node);

  // see if there is a group associated with us
  if (aInfo.group && aInfo.group.comment) {
    let group = aInfo.group;
    if (!group.info) {
      group.info = {};
      parse_comment(group.comment, group.info);
    }

    // copy-down everything in the info structure...
    for each (let [key, value] in Iterator(group.info)) {
      // but only if there isn't already something more explicit
      if (!(key in node))
        node[key] = value;
    }
  }

  // take a guess at visibility if it was not explicitly set or copied down from
  //  the group
  if (!("visibility" in node))
    node.visibility = (aName[0] != "_") ? "public" : "private";

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
  RE_OPTIONAL: /^\[([^\]=]+)(?:=([^\]]+))?\] /,
  _paramReturnCommon: function TagParser_paramReturnCommon(aText, aResObj,
                                                           aBlock, aNode,
                                                           aNeedsName) {
    // next there may be an optional type in braces
    if (aText[0] == '{') {
      let idxRBrace = aText.indexOf('}');
      if (idxRBrace) {
        aResObj.type = aText.substring(1, idxRBrace);
        aText = aText.substring(idxRBrace + 1).trimLeft();
      }
    }

    // there may be an "[optional]" decoration
    if (aNeedsName){
      let optMatch = this.RE_OPTIONAL.exec(aText);
      if (optMatch) {
        aResObj.optional = true;
        if (optMatch[2])
          aResObj.defaultValue = optMatch[2];
        aResObj.name = optMatch[1];
        aText = aText.substring(optMatch[0].length);
      }
      else {
        aResObj.optional = false;
        let idxSpace = aText.indexOf(" ");
        if (idxSpace == -1)
          idxSpace = aText.length;
        aResObj.name = aText.substring(0, idxSpace);
        aText = aText.substring(idxSpace+1).trimLeft();
      }
    }

    aResObj.stream = parse_comment_text(aText, aNode);
  },
  /**
   * The @param tag.  Allowed syntaxes:
   * - "@param parameterName comment""
   * - "@param {type} parameterName comment..."
   * - "@param [parameterName] comment..."
   * - "@param {type} [parameterName] comment..."
   * - "@param [parameterName=default] comment..."
   * - "@param {type} [parameterName=default] comment..."
   */
  param: function TagParser_param(aBlock, aNode) {
    if (aNode.params === undefined)
      aNode.params = [];
    let param = {};
    aNode.params.push(param);

    this._paramReturnCommon(aBlock.text, param, aBlock, aNode, true);
  },
  returns: function TagParser_return(aBlock, aNode) {
    aNode.returns = {};

    this._paramReturnCommon(aBlock.text, aNode.returns, aBlock, aNode);
  },
  /* === Groupy Things === */
  name: function TagParser_name(aBlock, aNode) {
    aNode.groupName = aBlock.text;
  },
  "public": function TagParser_public(aBlock, aNode) {
    aNode.visibility = "public";
    if (aNode.text)
      aNode.visibilityDescription = aBlock.text;
  },
  "protected": function TagParser_protected(aBlock, aNode) {
    aNode.visibility = "protected";
    if (aNode.text)
      aNode.visibilityDescription = aBlock.text;
  },
  "private": function TagParser_protected(aBlock, aNode) {
    aNode.visibility = "private";
    if (aNode.text)
      aNode.visibilityDescription = aBlock.text;
  }
};
TagParsers["return"] = TagParsers.returns;
TagParsers.groupName = TagParsers.name;

const REFERENCE_REGEX = /\|([^ |]+)\|/g;
/**
 * Parses a string for inline-markup, producing a textStream.
 *
 * @return An array of items where each thing is either a string (to be
 *     displayed as text) or a reference object.
 */
function parse_comment_text(aText, aNode) {
  let match;

  let stream = [];

  let curIndex = 0;
  while ((match = REFERENCE_REGEX.exec(aText)) != null) {
    if (match.index > curIndex)
      stream.push(aText.substring(curIndex, match.index));
    stream.push({type: "reference", name: match[1]});
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
 *
 * @param {String} aComment A block of all the comments between the code block
 *     preceding us and the code block corresponding to aNode.
 * @param aNode The output object.
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
      finishBlock();
      curBlock = {type: "bullet", text: line.substring(1).trimLeft() };
      blockStream.push(curBlock);
    }
    // some tag thing
    else if (line[0] == "@") {
      finishBlock();
      let idxEndTag = line.indexOf(" ");
      curBlock = {type: "tag",
                  tag: idxEndTag != -1 ?
                         line.substring(1, idxEndTag) :
                         line.substring(1),
                  text: idxEndTag != -1 ?
                          line.substring(idxEndTag+1).trimLeft() :
                          ""};
      // do not put the block in the blockStream, as tags should not actually
      //  be treated as part of the documentation stream.
      // However, we will process them for side-effects in finishBlock.
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

  if (blockStream.length)
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

function process_js(ast, f, argstr) {
  let oot = {
    filename: normalize_path(argstr || f),
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