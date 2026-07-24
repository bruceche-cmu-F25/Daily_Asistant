import { pythonDsaCheatsheet } from "./pythonDsaCheatsheet";
import { pythonCoreCheatsheet } from "./pythonCoreCheatsheet";
import { pythonDesignCheatsheet } from "./pythonDesignCheatsheet";
import { pythonInterviewCheatsheet } from "./pythonInterviewCheatsheet";
import { pythonOopCheatsheet } from "./pythonOopCheatsheet";
import { pythonProjectCheatsheet } from "./pythonProjectCheatsheet";

export type PythonCheatCategory =
  | "Syntax"
  | "List"
  | "Dict"
  | "Set"
  | "String"
  | "Tuple"
  | "File & JSON"
  | "Collections"
  | "Core Patterns"
  | "OOP"
  | "Project Engineering"
  | "Data Structures"
  | "Algorithms"
  | "Interview Patterns"
  | "Engineering Design";

export type PythonCheatItem = {
  id: string;
  category: PythonCheatCategory;
  title: string;
  action: string;
  description: string;
  syntax: string;
  code: string;
  aliases: string[];
  complexity?: string;
  whenToUse?: string;
  commonMistake?: string;
  exampleLabel?: string;
};

export const pythonCheatCategories: Array<"All" | PythonCheatCategory> = [
  "All", "Syntax", "List", "Dict", "Set", "String", "Tuple", "File & JSON", "Collections", "Core Patterns", "OOP", "Project Engineering", "Data Structures", "Algorithms", "Interview Patterns", "Engineering Design",
];

export const pythonCheatCategoryLabels: Record<PythonCheatCategory, string> = {
  Syntax: "Syntax",
  List: "List",
  Dict: "Dict",
  Set: "Set",
  String: "String",
  Tuple: "Tuple",
  "File & JSON": "File & JSON",
  Collections: "Collections",
  "Core Patterns": "Core Patterns",
  OOP: "OOP",
  "Project Engineering": "Project Engineering",
  "Data Structures": "Data Structures",
  Algorithms: "Algorithms",
  "Interview Patterns": "Interview Patterns",
  "Engineering Design": "Engineering Design",
};

export function pythonCategoryAnchorId(category: PythonCheatCategory) {
  return `python-directory-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export const pythonOfficialReferences = [
  { label: "BUILT-IN TYPES", detail: "Truth values, sequences, mappings and core operations", url: "https://docs.python.org/3/library/stdtypes.html" },
  { label: "STRING METHODS", detail: "All official str methods and immutability rules", url: "https://docs.python.org/3/library/stdtypes.html#string-methods" },
  { label: "LIST / SEQUENCES", detail: "Mutable sequence operations and list methods", url: "https://docs.python.org/3/library/stdtypes.html#mutable-sequence-types" },
  { label: "DICT", detail: "Mapping type operations and dictionary views", url: "https://docs.python.org/3/library/stdtypes.html#mapping-types-dict" },
  { label: "SET / FROZENSET", detail: "Set comparisons, algebra and mutation", url: "https://docs.python.org/3/library/stdtypes.html#set-types-set-frozenset" },
  { label: "CLASSES & OOP", detail: "Classes, inheritance, private variables and iterators", url: "https://docs.python.org/3/tutorial/classes.html" },
  { label: "DATA MODEL", detail: "Special methods, object model and class customization", url: "https://docs.python.org/3/reference/datamodel.html" },
  { label: "TYPING", detail: "Type hints, protocols, generics and typed dictionaries", url: "https://docs.python.org/3/library/typing.html" },
  { label: "ASYNCIO", detail: "Async tasks, synchronization and concurrent execution", url: "https://docs.python.org/3/library/asyncio.html" },
  { label: "LOGGING", detail: "Application logs, handlers, formatters and configuration", url: "https://docs.python.org/3/library/logging.html" },
  { label: "TESTING & MOCK", detail: "Unit tests, fixtures-style setup and test doubles", url: "https://docs.python.org/3/library/unittest.mock.html" },
  { label: "PACKAGING", detail: "Modern pyproject.toml packaging workflow", url: "https://packaging.python.org/en/latest/tutorials/packaging-projects/" },
] as const;

const pythonBasics: PythonCheatItem[] = [
  {
    id: "variables-unpack", category: "Syntax", title: "Assign & unpack", action: "变量赋值 / 解包",
    description: "一次给多个变量赋值；用 * 接住剩余元素。", syntax: "a, b = values   |   first, *rest = values",
    code: "point = (3, 8)\nx, y = point\n\nfirst, *rest = [10, 20, 30]\n# first == 10, rest == [20, 30]",
    aliases: ["assign variable", "unpack tuple", "multiple assignment", "变量赋值", "解包"],
  },
  {
    id: "conditionals", category: "Syntax", title: "if / elif / else", action: "条件判断",
    description: "条件从上到下判断，只执行第一个命中的分支。", syntax: "if condition: ... elif other: ... else: ...",
    code: "score = 82\nif score >= 90:\n    grade = \"A\"\nelif score >= 80:\n    grade = \"B\"\nelse:\n    grade = \"C\"",
    aliases: ["if else", "elif", "conditional", "condition", "条件", "判断"],
  },
  {
    id: "for-enumerate", category: "Syntax", title: "Loop with index", action: "遍历并取得下标",
    description: "enumerate 同时给出 index 和 value，避免手动维护计数器。", syntax: "for index, value in enumerate(items, start=0):",
    code: "names = [\"Ada\", \"Linus\"]\nfor index, name in enumerate(names, start=1):\n    print(index, name)\n# 1 Ada\n# 2 Linus",
    aliases: ["for loop", "enumerate", "loop index", "iterate index", "遍历", "下标"],
  },
  {
    id: "zip-loop", category: "Syntax", title: "Loop in parallel", action: "同时遍历多个序列",
    description: "zip 按位置配对；默认在最短序列结束时停止。", syntax: "for left, right in zip(left_items, right_items):",
    code: "names = [\"Ada\", \"Linus\"]\nscores = [98, 95]\nfor name, score in zip(names, scores):\n    print(f\"{name}: {score}\")",
    aliases: ["zip", "parallel loop", "iterate two lists", "同时遍历", "配对"],
  },
  {
    id: "function", category: "Syntax", title: "Define a function", action: "定义函数",
    description: "参数可以有默认值；类型标注让接口更容易理解。", syntax: "def name(arg: Type = default) -> ReturnType:",
    code: "def greet(name: str, loud: bool = False) -> str:\n    message = f\"Hello, {name}\"\n    return message.upper() if loud else message\n\ngreet(\"Bruce\", loud=True)",
    aliases: ["def", "function", "default argument", "type hint", "定义函数", "参数"],
  },
  {
    id: "comprehension", category: "Syntax", title: "List comprehension", action: "列表推导式",
    description: "把映射和过滤写在一个表达式中，适合简单转换。", syntax: "[expression for item in items if condition]",
    code: "numbers = [1, 2, 3, 4, 5]\neven_squares = [n * n for n in numbers if n % 2 == 0]\n# [4, 16]",
    aliases: ["list comprehension", "map filter", "推导式", "过滤列表", "transform list"],
  },
  {
    id: "try-except", category: "Syntax", title: "Handle errors", action: "捕获异常",
    description: "只捕获你能处理的具体异常；finally 无论成功失败都会执行。", syntax: "try: ... except ValueError: ... finally: ...",
    code: "try:\n    count = int(\"12x\")\nexcept ValueError as error:\n    print(f\"Bad number: {error}\")\nfinally:\n    print(\"finished\")",
    aliases: ["try except", "exception", "catch error", "handle error", "异常", "报错处理"],
  },
  {
    id: "list-access", category: "List", title: "Access list item", action: "访问 List 元素",
    description: "下标从 0 开始；负数从末尾倒数。", syntax: "items[index]   |   items[-1]",
    code: "colors = [\"red\", \"green\", \"blue\"]\nfirst = colors[0]   # \"red\"\nlast = colors[-1]  # \"blue\"",
    aliases: ["access list", "list access", "get list item", "list index", "访问列表", "数组下标"],
  },
  {
    id: "list-slice", category: "List", title: "Slice a list", action: "切片 / 复制 List",
    description: "切片左闭右开；省略边界可从头或取到末尾。", syntax: "items[start:stop:step]",
    code: "nums = [0, 1, 2, 3, 4]\nmiddle = nums[1:4]   # [1, 2, 3]\nreversed_nums = nums[::-1]\ncopy = nums[:]",
    aliases: ["slice list", "list slice", "reverse list", "copy list", "列表切片", "反转列表"],
  },
  {
    id: "list-add", category: "List", title: "Add to list", action: "添加 List 元素",
    description: "append 加一个元素，extend 加入另一组元素，insert 插到指定位置。", syntax: "append(value) | extend(values) | insert(index, value)",
    code: "items = [1, 2]\nitems.append(3)       # [1, 2, 3]\nitems.extend([4, 5])  # [1, 2, 3, 4, 5]\nitems.insert(0, 0)    # [0, 1, 2, 3, 4, 5]",
    aliases: ["add list", "list add", "append list", "extend list", "insert list", "添加列表", "追加元素"],
  },
  {
    id: "list-update", category: "List", title: "Update list item", action: "修改 List 元素",
    description: "直接给指定下标或切片赋值。", syntax: "items[index] = value",
    code: "colors = [\"red\", \"green\", \"blue\"]\ncolors[1] = \"lime\"\n# [\"red\", \"lime\", \"blue\"]",
    aliases: ["update list", "change list item", "replace list item", "修改列表", "更新元素"],
  },
  {
    id: "list-delete", category: "List", title: "Remove from list", action: "删除 List 元素",
    description: "remove 按值删第一个匹配；pop 按下标删除并返回；del 直接删除。", syntax: "remove(value) | pop(index) | del items[index]",
    code: "items = [\"a\", \"b\", \"c\"]\nitems.remove(\"b\")  # [\"a\", \"c\"]\nlast = items.pop()    # last == \"c\"\ndel items[0]          # []",
    aliases: ["delete list", "remove list", "pop list", "del list", "删除列表", "移除元素"],
  },
  {
    id: "list-sort", category: "List", title: "Sort a list", action: "排序 List",
    description: "sorted 返回新列表；list.sort 原地修改。key 指定排序依据。", syntax: "sorted(items, key=..., reverse=False)",
    code: "users = [{\"name\": \"Ada\", \"age\": 36}, {\"name\": \"Linus\", \"age\": 30}]\nby_age = sorted(users, key=lambda user: user[\"age\"])",
    aliases: ["sort list", "sorted", "sort key", "排序列表", "按字段排序"],
  },
  {
    id: "list-find-count", category: "List", title: "Find or count list values", action: "查找 / 统计 List",
    description: "index 返回第一个匹配位置，找不到会抛 ValueError；count 返回出现次数。", syntax: "items.index(value, start, stop)   |   items.count(value)",
    code: "items = [\"a\", \"b\", \"a\"]\nfirst_a = items.index(\"a\")  # 0\na_count = items.count(\"a\") # 2\n\nif \"c\" in items:\n    position = items.index(\"c\")",
    aliases: ["list index", "list count", "find list value", "search list", "查找列表", "统计列表"],
  },
  {
    id: "list-copy-clear", category: "List", title: "Copy or clear a list", action: "复制 / 清空 List",
    description: "copy 创建浅拷贝；clear 原地删除全部元素。嵌套对象仍然共享。", syntax: "copy = items.copy()   |   items.clear()",
    code: "items = [1, 2, 3]\nbackup = items.copy()\nitems.clear()\n# items == []\n# backup == [1, 2, 3]",
    aliases: ["list copy", "copy list", "list clear", "clear list", "shallow copy", "复制列表", "清空列表"],
  },
  {
    id: "list-reverse", category: "List", title: "Reverse a list in place", action: "原地反转 List",
    description: "reverse 原地修改并返回 None；reversed 返回迭代器；[::-1] 返回新列表。", syntax: "items.reverse()   |   reversed(items)   |   items[::-1]",
    code: "items = [1, 2, 3]\nitems.reverse()       # [3, 2, 1]\nnew_copy = items[::-1] # [1, 2, 3]\niterator = reversed(items)",
    aliases: ["list reverse", "reverse list in place", "reversed", "反转列表", "倒序列表"],
  },
  {
    id: "dict-access", category: "Dict", title: "Access dict value", action: "访问 Dict / 字典",
    description: "[] 在 key 不存在时抛 KeyError；get 可提供安全默认值。", syntax: "mapping[key]   |   mapping.get(key, default)",
    code: "user = {\"name\": \"Ada\", \"role\": \"engineer\"}\nname = user[\"name\"]             # \"Ada\"\ncity = user.get(\"city\", \"N/A\")  # \"N/A\"",
    aliases: ["access dict", "dict access", "get dict", "dict get", "dictionary lookup", "访问字典", "读取字典", "取 key"],
  },
  {
    id: "dict-add-update", category: "Dict", title: "Add or update dict", action: "新增 / 修改 Dict",
    description: "对 key 赋值即可新增或覆盖；update 可以一次合并多个字段。", syntax: "mapping[key] = value   |   mapping.update({...})",
    code: "user = {\"name\": \"Ada\"}\nuser[\"city\"] = \"London\"       # add\nuser[\"city\"] = \"San Francisco\" # update\nuser.update({\"active\": True, \"score\": 98})",
    aliases: ["add dict", "update dict", "set dict", "dict assign", "新增字典", "修改字典", "字典赋值"],
  },
  {
    id: "dict-delete", category: "Dict", title: "Remove dict key", action: "删除 Dict key",
    description: "pop 删除并返回值，还可提供默认值；del 在 key 不存在时抛 KeyError。", syntax: "mapping.pop(key, default)   |   del mapping[key]",
    code: "user = {\"name\": \"Ada\", \"temp\": True}\nremoved = user.pop(\"temp\", None)\n# user == {\"name\": \"Ada\"}",
    aliases: ["delete dict", "remove dict key", "dict pop", "del dict", "删除字典", "移除 key"],
  },
  {
    id: "dict-iterate", category: "Dict", title: "Iterate a dict", action: "遍历 Dict",
    description: "items 同时返回 key 和 value；keys/values 可只取一侧。", syntax: "for key, value in mapping.items():",
    code: "scores = {\"Ada\": 98, \"Linus\": 95}\nfor name, score in scores.items():\n    print(name, score)",
    aliases: ["iterate dict", "loop dict", "dict items", "keys values", "遍历字典", "字典循环"],
  },
  {
    id: "dict-setdefault", category: "Dict", title: "Group with setdefault", action: "初始化并聚合 Dict",
    description: "key 不存在时写入默认值，然后返回该值；常用于分组。", syntax: "mapping.setdefault(key, default)",
    code: "groups = {}\nfor name, team in [(\"Ada\", \"A\"), (\"Linus\", \"A\")]:\n    groups.setdefault(team, []).append(name)\n# {\"A\": [\"Ada\", \"Linus\"]}",
    aliases: ["dict setdefault", "group dict", "initialize dict", "字典默认值", "字典分组"],
  },
  {
    id: "dict-views", category: "Dict", title: "Dict keys, values & items", action: "读取 Dict 视图",
    description: "keys、values、items 返回随字典变化的动态 view，不是独立列表。", syntax: "mapping.keys() | mapping.values() | mapping.items()",
    code: "user = {\"name\": \"Ada\", \"score\": 98}\nkeys = user.keys()       # dict_keys([...])\nvalues = user.values()   # dict_values([...])\npairs = user.items()     # dict_items([...])\nkey_list = list(keys)",
    aliases: ["dict keys", "dict values", "dict items", "dictionary view", "读取字典", "字典键", "字典值"],
  },
  {
    id: "dict-copy-clear", category: "Dict", title: "Copy or clear a dict", action: "复制 / 清空 Dict",
    description: "copy 创建浅拷贝；clear 原地删除全部键值对。", syntax: "backup = mapping.copy()   |   mapping.clear()",
    code: "settings = {\"theme\": \"dark\", \"sound\": True}\nbackup = settings.copy()\nsettings.clear()\n# settings == {}",
    aliases: ["dict copy", "copy dict", "dict clear", "clear dict", "复制字典", "清空字典"],
  },
  {
    id: "dict-fromkeys", category: "Dict", title: "Create dict from keys", action: "从 Keys 创建 Dict",
    description: "fromkeys 给所有 key 设置同一个默认值；不要用可变对象作为共享默认值。", syntax: "dict.fromkeys(keys, default)",
    code: "fields = [\"name\", \"email\", \"role\"]\nrecord = dict.fromkeys(fields, None)\n# {\"name\": None, \"email\": None, \"role\": None}",
    aliases: ["dict fromkeys", "create dict from list", "initialize keys", "从键创建字典", "初始化字典"],
  },
  {
    id: "dict-merge", category: "Dict", title: "Merge dictionaries", action: "合并 Dict",
    description: "| 返回新字典；|= 和 update 原地修改。右侧相同 key 会覆盖左侧。", syntax: "merged = left | right   |   left |= right",
    code: "defaults = {\"theme\": \"light\", \"page_size\": 20}\noverrides = {\"theme\": \"dark\"}\nsettings = defaults | overrides\n# {\"theme\": \"dark\", \"page_size\": 20}",
    aliases: ["merge dict", "combine dict", "dict union", "dict update", "合并字典", "字典覆盖"],
  },
  {
    id: "dict-popitem", category: "Dict", title: "Pop last dict item", action: "弹出最后一对 Dict",
    description: "popitem 按 LIFO 删除并返回最后插入的 (key, value)；空字典会抛 KeyError。", syntax: "key, value = mapping.popitem()",
    code: "queue = {\"first\": 1, \"last\": 2}\nkey, value = queue.popitem()\n# key == \"last\", value == 2\n# queue == {\"first\": 1}",
    aliases: ["dict popitem", "pop last dict", "remove last key", "弹出字典", "删除最后键值"],
  },
  {
    id: "set-create", category: "Set", title: "Create a set", action: "创建 Set / 去重",
    description: "set 只保留唯一值；空 set 必须写 set()，因为 {} 是 dict。", syntax: "unique = set(iterable)",
    code: "unique = set([1, 1, 2, 3])\n# {1, 2, 3}\nempty = set()",
    aliases: ["create set", "unique values", "deduplicate", "remove duplicates", "创建集合", "去重"],
  },
  {
    id: "set-add", category: "Set", title: "Add to set", action: "添加 Set 元素",
    description: "add 加一个值；update 从可迭代对象加入多个值，重复项自动忽略。", syntax: "values.add(item)   |   values.update(iterable)",
    code: "tags = {\"python\"}\ntags.add(\"fastapi\")\ntags.update([\"react\", \"python\"])\n# {\"python\", \"fastapi\", \"react\"}",
    aliases: ["add set", "set add", "append set", "update set", "insert set", "添加集合", "集合增加"],
  },
  {
    id: "set-delete", category: "Set", title: "Remove from set", action: "删除 Set 元素",
    description: "discard 在值不存在时不报错；remove 会抛 KeyError。", syntax: "values.discard(item)   |   values.remove(item)",
    code: "tags = {\"python\", \"react\"}\ntags.discard(\"react\")\ntags.discard(\"missing\")  # safe\n# {\"python\"}",
    aliases: ["delete set", "remove set", "discard set", "set remove", "删除集合", "移除集合"],
  },
  {
    id: "set-operations", category: "Set", title: "Set operations", action: "集合交并差",
    description: "用集合快速计算共同、全部或只存在于一侧的元素。", syntax: "a & b   |   a | b   |   a - b   |   a ^ b",
    code: "a = {1, 2, 3}\nb = {3, 4}\na & b  # {3} intersection\na | b  # {1, 2, 3, 4} union\na - b  # {1, 2} difference",
    aliases: ["set union", "set intersection", "set difference", "集合并集", "集合交集", "集合差集"],
  },
  {
    id: "membership", category: "Set", title: "Membership check", action: "检查是否存在",
    description: "in / not in 可用于 set、dict、list、string；频繁查找优先用 set/dict。", syntax: "value in collection   |   value not in collection",
    code: "seen = {\"ada@example.com\", \"linus@example.com\"}\nif \"ada@example.com\" in seen:\n    print(\"already processed\")",
    aliases: ["membership", "contains", "in set", "check exists", "是否存在", "包含", "查找 set"],
  },
  {
    id: "set-relations", category: "Set", title: "Compare set relationships", action: "判断子集 / 超集 / 不相交",
    description: "用 <=、>= 判断包含关系；isdisjoint 判断两个集合是否完全没有共同元素。", syntax: "a <= b | a < b | a >= b | a.isdisjoint(b)",
    code: "backend = {\"python\", \"sql\"}\nfullstack = {\"python\", \"sql\", \"react\"}\nbackend <= fullstack          # True\nbackend < fullstack           # True proper subset\nbackend.isdisjoint({\"java\"}) # True",
    aliases: ["set subset", "set superset", "issubset", "issuperset", "isdisjoint", "集合子集", "集合超集", "不相交"],
  },
  {
    id: "set-in-place-operations", category: "Set", title: "Update set in place", action: "原地交并差 Set",
    description: "这些 update 方法直接修改左侧集合；对应普通方法会返回新集合。", syntax: "update | intersection_update | difference_update | symmetric_difference_update",
    code: "skills = {\"python\", \"react\"}\nskills.update({\"sql\"})\nskills.intersection_update({\"python\", \"sql\"})\n# {\"python\", \"sql\"}\nskills.difference_update({\"sql\"})\n# {\"python\"}",
    aliases: ["set update", "intersection update", "difference update", "symmetric difference update", "原地集合", "更新集合"],
  },
  {
    id: "set-copy-pop-clear", category: "Set", title: "Copy, pop or clear set", action: "复制 / 弹出 / 清空 Set",
    description: "copy 浅拷贝；pop 删除任意元素，不能假设顺序；clear 删除全部元素。", syntax: "copy() | pop() | clear()",
    code: "values = {10, 20, 30}\nbackup = values.copy()\nitem = values.pop()  # arbitrary item\nvalues.clear()       # set()",
    aliases: ["set copy", "set pop", "set clear", "copy set", "clear set", "复制集合", "清空集合", "弹出集合"],
  },
  {
    id: "frozenset", category: "Set", title: "Immutable frozenset", action: "不可变 Set",
    description: "frozenset 不能增删，因此可作为 dict key 或另一个 set 的元素。", syntax: "frozen = frozenset(iterable)",
    code: "permissions = frozenset({\"read\", \"write\"})\ncache = {permissions: \"editor\"}\n# permissions.add(\"admin\")  # AttributeError",
    aliases: ["frozenset", "immutable set", "hashable set", "不可变集合", "集合做 key"],
  },
  {
    id: "string-access-slice", category: "String", title: "Access & slice string", action: "访问 / 切片 String",
    description: "字符串不可变；索引和切片会返回新字符串。", syntax: "text[index]   |   text[start:stop]",
    code: "text = \"python\"\nfirst = text[0]      # \"p\"\nlast = text[-1]      # \"n\"\nprefix = text[:3]   # \"pyt\"",
    aliases: ["access string", "string index", "slice string", "访问字符串", "字符串切片"],
  },
  {
    id: "string-split-join", category: "String", title: "Split & join", action: "拆分 / 拼接 String",
    description: "split 把字符串变列表；join 把字符串序列连接起来。", syntax: "text.split(separator)   |   separator.join(parts)",
    code: "csv = \"python,fastapi,react\"\nparts = csv.split(\",\")\nlabel = \" / \".join(parts)\n# \"python / fastapi / react\"",
    aliases: ["split string", "join string", "string to list", "list to string", "拆分字符串", "拼接字符串"],
  },
  {
    id: "string-clean", category: "String", title: "Clean & replace string", action: "清理 / 替换 String",
    description: "strip 去两端空白；replace 替换所有匹配子串。", syntax: "text.strip()   |   text.replace(old, new)",
    code: "raw = \"  hello world  \"\nclean = raw.strip().replace(\"world\", \"Bruce\")\n# \"hello Bruce\"",
    aliases: ["strip string", "replace string", "trim string", "clean text", "清理字符串", "替换字符串"],
  },
  {
    id: "string-modify", category: "String", title: "Modify a string", action: "修改 String（创建新值）",
    description: "str 是 immutable，不能执行 text[0] = ...；要通过切片、拼接或 replace 创建新字符串。", syntax: "new_text = replacement + text[1:]",
    code: "text = \"cat\"\n# text[0] = \"b\"  # TypeError\nchanged = \"b\" + text[1:]      # \"bat\"\nreplaced = text.replace(\"c\", \"h\") # \"hat\"\n# original text is still \"cat\"",
    aliases: ["string modification", "modify string", "change string", "update string", "string immutable", "修改字符串", "更新字符串", "字符串不可变"],
  },
  {
    id: "string-case", category: "String", title: "Change string case", action: "转换 String 大小写",
    description: "casefold 适合不区分大小写比较；capitalize/title 改变单词样式；这些都返回新字符串。", syntax: "lower | upper | casefold | capitalize | title | swapcase",
    code: "text = \"pYTHON Straße\"\ntext.lower()       # \"python straße\"\ntext.upper()       # \"PYTHON STRASSE\"\ntext.casefold()    # \"python strasse\"\ntext.title()       # \"Python Straße\"\ntext.swapcase()    # \"Python sTRASSE\"",
    aliases: ["string lower", "string upper", "casefold", "capitalize", "title case", "swapcase", "字符串大小写", "转小写", "转大写"],
  },
  {
    id: "string-find-count", category: "String", title: "Find & count substring", action: "查找 / 统计子字符串",
    description: "find/rfind 找不到返回 -1；index/rindex 找不到抛 ValueError；count 统计不重叠次数。", syntax: "find | rfind | index | rindex | count",
    code: "text = \"banana\"\ntext.find(\"na\")    # 2\ntext.rfind(\"na\")   # 4\ntext.count(\"na\")   # 2\ntext.find(\"x\")     # -1\n# text.index(\"x\")  # ValueError",
    aliases: ["string find", "string index", "substring", "rfind", "rindex", "string count", "查找字符串", "统计子串"],
  },
  {
    id: "string-prefix-suffix", category: "String", title: "Check or remove prefix/suffix", action: "检查 / 删除前后缀",
    description: "startswith/endswith 返回 bool；removeprefix/removesuffix 只在匹配时删除一次。", syntax: "startswith | endswith | removeprefix | removesuffix",
    code: "filename = \"report.csv\"\nfilename.endswith(\".csv\")       # True\nfilename.removesuffix(\".csv\")   # \"report\"\nurl = \"https://example.com\"\nurl.removeprefix(\"https://\")     # \"example.com\"",
    aliases: ["startswith", "endswith", "removeprefix", "removesuffix", "string prefix", "string suffix", "字符串前缀", "字符串后缀"],
  },
  {
    id: "string-split-lines", category: "String", title: "Split strings and lines", action: "按分隔符 / 行拆分 String",
    description: "split 从左拆，rsplit 可限制右侧次数；splitlines 正确处理多种换行符。", syntax: "split | rsplit | splitlines",
    code: "path = \"home/bruce/project/file.py\"\npath.rsplit(\"/\", maxsplit=1) # [\"home/bruce/project\", \"file.py\"]\ntext = \"first\\nsecond\\r\\nthird\"\ntext.splitlines()             # [\"first\", \"second\", \"third\"]",
    aliases: ["string rsplit", "splitlines", "split lines", "line split", "按行拆分", "从右拆分字符串"],
  },
  {
    id: "string-partition", category: "String", title: "Partition a string", action: "把 String 分成三段",
    description: "partition 总是返回 (before, separator, after)，比 split(maxsplit=1) 更适合解析键值。", syntax: "before, sep, after = text.partition(separator)",
    code: "line = \"status=active\"\nkey, separator, value = line.partition(\"=\")\n# key == \"status\"\n# separator == \"=\"\n# value == \"active\"",
    aliases: ["string partition", "rpartition", "split once", "parse key value", "字符串分区", "拆成三段"],
  },
  {
    id: "string-strip", category: "String", title: "Strip string edges", action: "删除 String 两端字符",
    description: "strip/lstrip/rstrip 删除两端字符集合，不是删除一个完整子串；删除前后缀用 remove*。", syntax: "strip(chars) | lstrip(chars) | rstrip(chars)",
    code: "raw = \"  hello  \"\nraw.strip()          # \"hello\"\n\"www.example.com\".lstrip(\"wm.\") # \"example.com\"\n\"file.txt...\".rstrip(\".\")       # \"file.txt\"",
    aliases: ["string strip", "lstrip", "rstrip", "trim whitespace", "去空格", "删除两端字符"],
  },
  {
    id: "string-align", category: "String", title: "Align, pad & expand string", action: "对齐 / 填充 String",
    description: "center/ljust/rjust 控制宽度；zfill 在数字前补零；expandtabs 把 tab 展开为空格。", syntax: "center | ljust | rjust | zfill | expandtabs",
    code: "\"PY\".center(8, \"-\")  # \"---PY---\"\n\"42\".zfill(5)         # \"00042\"\n\"name\".ljust(10, \".\") # \"name......\"\n\"a\\tb\".expandtabs(4)  # \"a   b\"",
    aliases: ["string center", "ljust", "rjust", "zfill", "expandtabs", "pad string", "字符串对齐", "补零"],
  },
  {
    id: "string-tests", category: "String", title: "Test string contents", action: "判断 String 字符类型",
    description: "is* 方法检查非空字符串是否全部满足条件；isidentifier 可验证变量名形式。", syntax: "isalpha | isalnum | isdigit | isnumeric | isspace | isidentifier | ...",
    code: "\"Python3\".isalnum()    # True\n\"Python\".isalpha()     # True\n\"123\".isdigit()       # True\n\"变量\".isidentifier() # True\n\"  \".isspace()        # True\n\"abc\".islower()       # True",
    aliases: ["isalpha", "isalnum", "isascii", "isdecimal", "isdigit", "isnumeric", "isidentifier", "isprintable", "isspace", "islower", "isupper", "istitle", "字符串判断", "是否数字"],
  },
  {
    id: "string-translate", category: "String", title: "Translate many characters", action: "批量映射 / 删除字符",
    description: "maketrans 创建翻译表，translate 一次替换或删除多个字符，适合规范化文本。", syntax: "table = str.maketrans(mapping)   |   text.translate(table)",
    code: "table = str.maketrans({\"a\": \"@\", \"e\": \"3\", \"!\": None})\nresult = \"Peace!\".translate(table)\n# \"P3@c3\"",
    aliases: ["string translate", "maketrans", "character mapping", "delete characters", "字符映射", "批量替换字符"],
  },
  {
    id: "string-encode", category: "String", title: "Encode & decode text", action: "String 与 Bytes 转换",
    description: "encode 把 str 变 bytes；decode 把 bytes 还原为 str。网络和文件边界常用 UTF-8。", syntax: "data = text.encode('utf-8')   |   text = data.decode('utf-8')",
    code: "text = \"你好 Python\"\ndata = text.encode(\"utf-8\")\nrestored = data.decode(\"utf-8\")\n# restored == text",
    aliases: ["string encode", "bytes decode", "utf8", "text to bytes", "bytes to string", "字符串编码", "解码"],
  },
  {
    id: "string-format-methods", category: "String", title: "Format string templates", action: "format / format_map 模板",
    description: "format 接收参数；format_map 直接读取 mapping。新代码通常优先 f-string。", syntax: "template.format(...)   |   template.format_map(mapping)",
    code: "template = \"{name} has {count:02d} tasks\"\nmessage = template.format(name=\"Bruce\", count=3)\n# \"Bruce has 03 tasks\"\ndata = {\"name\": \"Ada\", \"count\": 8}\ntemplate.format_map(data)",
    aliases: ["string format", "format_map", "format template", "字符串模板", "字符串格式化"],
  },
  {
    id: "f-string", category: "String", title: "Format with f-string", action: "格式化 String",
    description: "在字符串中直接嵌入表达式；格式说明可控制小数、宽度和日期。", syntax: "f\"text {expression:format_spec}\"",
    code: "name = \"Bruce\"\nscore = 93.456\nmessage = f\"{name}: {score:.1f}%\"\n# \"Bruce: 93.5%\"",
    aliases: ["f string", "format string", "string interpolation", "字符串格式化", "插值"],
  },
  {
    id: "tuple-access", category: "Tuple", title: "Tuple access & unpack", action: "访问 / 解包 Tuple",
    description: "tuple 有顺序但不可修改，适合固定结构的数据。", syntax: "value = pair[index]   |   left, right = pair",
    code: "coordinate = (37.4, -122.1)\nlatitude = coordinate[0]\nlat, lng = coordinate",
    aliases: ["access tuple", "tuple index", "unpack tuple", "访问元组", "元组解包"],
  },
  {
    id: "tuple-find-count", category: "Tuple", title: "Find or count tuple values", action: "查找 / 统计 Tuple",
    description: "tuple 只有两个专属方法：index 找位置，count 统计次数。", syntax: "values.index(item)   |   values.count(item)",
    code: "values = (\"a\", \"b\", \"a\")\nvalues.index(\"b\") # 1\nvalues.count(\"a\") # 2",
    aliases: ["tuple index", "tuple count", "find tuple", "查找元组", "统计元组"],
  },
  {
    id: "file-read", category: "File & JSON", title: "Read a text file", action: "读取 File",
    description: "with 会自动关闭文件；Path.read_text 适合一次读取整个小文件。", syntax: "Path(path).read_text(encoding=\"utf-8\")",
    code: "from pathlib import Path\n\ntext = Path(\"notes.txt\").read_text(encoding=\"utf-8\")\nlines = text.splitlines()",
    aliases: ["read file", "file read", "open file", "path read text", "读取文件", "读文件"],
  },
  {
    id: "file-write", category: "File & JSON", title: "Write or append file", action: "写入 / 追加 File",
    description: "write_text 会覆盖；open(..., 'a') 追加且保留原内容。", syntax: "write_text(text)   |   open(path, 'a')",
    code: "from pathlib import Path\n\nPath(\"report.txt\").write_text(\"first line\\n\", encoding=\"utf-8\")\nwith open(\"report.txt\", \"a\", encoding=\"utf-8\") as file:\n    file.write(\"next line\\n\")",
    aliases: ["write file", "append file", "file write", "save text", "写入文件", "追加文件"],
  },
  {
    id: "json-read-write", category: "File & JSON", title: "Read & write JSON", action: "读写 JSON",
    description: "json.load/dump 处理文件对象；loads/dumps 处理字符串。", syntax: "json.load(file)   |   json.dump(data, file)",
    code: "import json\n\nwith open(\"user.json\", encoding=\"utf-8\") as file:\n    user = json.load(file)\n\nwith open(\"user.json\", \"w\", encoding=\"utf-8\") as file:\n    json.dump(user, file, ensure_ascii=False, indent=2)",
    aliases: ["read json", "write json", "json load", "json dump", "parse json", "读 json", "写 json"],
  },
  {
    id: "counter", category: "Collections", title: "Count frequencies", action: "统计出现次数",
    description: "Counter 是带默认 0 的计数字典，most_common 返回高频项。", syntax: "Counter(iterable).most_common(n)",
    code: "from collections import Counter\n\ncounts = Counter(\"banana\")\ncounts[\"a\"]          # 3\ncounts.most_common(2)  # [(\"a\", 3), (\"n\", 2)]",
    aliases: ["counter", "count frequency", "frequency map", "most common", "计数", "频率统计"],
  },
  {
    id: "defaultdict", category: "Collections", title: "Default dict", action: "自动初始化 Dict",
    description: "访问缺失 key 时自动创建默认值，适合分组和图邻接表。", syntax: "defaultdict(list)   |   defaultdict(int)",
    code: "from collections import defaultdict\n\ngroups = defaultdict(list)\nfor name, team in [(\"Ada\", \"A\"), (\"Linus\", \"A\")]:\n    groups[team].append(name)",
    aliases: ["defaultdict", "default dict", "group items", "adjacency list", "默认字典", "自动初始化"],
  },
  {
    id: "deque", category: "Collections", title: "Queue with deque", action: "队列 / 双端队列",
    description: "deque 两端增删都是 O(1)，BFS 队列优先使用它。", syntax: "append / appendleft / pop / popleft",
    code: "from collections import deque\n\nqueue = deque([\"first\"])\nqueue.append(\"second\")\ncurrent = queue.popleft()  # \"first\"",
    aliases: ["deque", "queue", "popleft", "bfs queue", "队列", "双端队列"],
  },
  {
    id: "heap", category: "Collections", title: "Min heap / priority queue", action: "最小堆 / 优先队列",
    description: "heapq 默认最小堆；push/pop 都是 O(log n)。", syntax: "heappush(heap, value)   |   heappop(heap)",
    code: "import heapq\n\nheap = [5, 2, 8]\nheapq.heapify(heap)\nheapq.heappush(heap, 1)\nsmallest = heapq.heappop(heap)  # 1",
    aliases: ["heap", "heapq", "priority queue", "min heap", "最小堆", "优先队列"],
  },
];

export const pythonCheatsheet: PythonCheatItem[] = [
  ...pythonBasics,
  ...pythonCoreCheatsheet,
  ...pythonOopCheatsheet,
  ...pythonProjectCheatsheet,
  ...pythonDsaCheatsheet,
  ...pythonInterviewCheatsheet,
  ...pythonDesignCheatsheet,
];

export function pythonCheatSearchText(item: PythonCheatItem) {
  const categoryTerms: Record<PythonCheatCategory, string> = {
    Syntax: "syntax statement expression",
    List: "list mutable sequence",
    Dict: "dict dictionary mapping",
    Set: "set frozenset",
    String: "string str text",
    Tuple: "tuple immutable sequence",
    "File & JSON": "file json io path",
    Collections: "collections container",
    "Core Patterns": "python core language pattern idiom pitfall",
    OOP: "object oriented programming class object design pattern 面向对象",
    "Project Engineering": "project engineering testing debugging packaging production",
    "Data Structures": "data structure implementation dsa",
    Algorithms: "algorithm implementation dsa pattern",
    "Interview Patterns": "coding interview leetcode neetcode template pattern",
    "Engineering Design": "software architecture design maintainable testable code",
  };
  return [item.title, item.action, item.category, categoryTerms[item.category], item.description, item.syntax, item.code, item.complexity ?? "", item.whenToUse ?? "", item.commonMistake ?? "", item.exampleLabel ?? "", ...item.aliases]
    .join(" ")
    .toLowerCase();
}

export function normalizePythonCheatQuery(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, " ").trim();
}

const pythonQueryStopPhrases = [
  "我想知道", "可以帮我", "请告诉我", "在 python 里面", "在python里面",
  "在 python 里", "在python里", "python 中", "python中", "怎么安全地",
  "如何安全地", "怎么安全", "如何安全", "怎么", "如何", "请问", "帮我",
  "我想", "安全地", "安全", "一下", "一个", "的",
];

const pythonQueryStopTokens = new Set([
  "how", "to", "do", "does", "can", "i", "please", "with", "in", "python",
  "用", "在", "里", "中", "吗", "呢",
]);

const pythonQuerySynonyms: Array<[string, string]> = [
  ["列表", "list"], ["数组", "list"], ["字典", "dict"], ["映射", "dict"],
  ["集合", "set"], ["字符串", "string"], ["元组", "tuple"], ["队列", "queue"],
  ["栈", "stack"], ["链表", "linked list"], ["二叉树", "tree"], ["图", "graph"],
  ["测试", "test"], ["异常", "exception"], ["并发", "concurrency"],
];

function stripPythonQueryFiller(value: string) {
  let cleaned = value.toLowerCase();
  for (const phrase of pythonQueryStopPhrases) cleaned = cleaned.replaceAll(phrase, " ");
  return cleaned;
}

export function pythonCheatQueryTerms(value: string) {
  const normalized = normalizePythonCheatQuery(stripPythonQueryFiller(value));
  const tokens = normalized.split(/\s+/).filter((token) => token && !pythonQueryStopTokens.has(token));
  return [...new Set(tokens.length ? tokens : normalizePythonCheatQuery(value).split(/\s+/).filter(Boolean))];
}

function pythonQueryVariants(token: string) {
  const variants = new Set([token]);
  for (const [left, right] of pythonQuerySynonyms) {
    if (token.includes(left)) variants.add(token.replaceAll(left, right));
    if (token.includes(right)) variants.add(token.replaceAll(right, left));
  }
  return [...variants];
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(previous[rightIndex] + 1, current[rightIndex - 1] + 1, substitution);
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function fuzzyWordMatch(searchable: string, token: string) {
  if (!/^[a-z0-9]+$/.test(token) || token.length < 4) return false;
  const threshold = token.length >= 8 ? 2 : 1;
  return searchable.split(/\s+/).some((word) => (
    /^[a-z0-9]+$/.test(word)
    && Math.abs(word.length - token.length) <= threshold
    && editDistance(word, token) <= threshold
  ));
}

function weightedFieldScore(value: string, token: string, weight: number) {
  const searchable = normalizePythonCheatQuery(value);
  let best = 0;
  for (const variant of pythonQueryVariants(token)) {
    if (searchable === variant) best = Math.max(best, weight * 3);
    else if (searchable.startsWith(variant)) best = Math.max(best, weight * 2.2);
    else if (searchable.includes(variant)) best = Math.max(best, weight * 1.5);
    else if (fuzzyWordMatch(searchable, variant)) best = Math.max(best, weight * .65);
  }
  return best;
}

export function pythonCheatSearchScore(item: PythonCheatItem, query: string) {
  const tokens = pythonCheatQueryTerms(query);
  if (!tokens.length) return 0;
  const fields: Array<[string, number]> = [
    [item.action, 120], [item.title, 115], [item.aliases.join(" "), 95],
    [item.category, 60], [item.description, 45], [item.syntax, 38],
    [item.whenToUse ?? "", 28], [item.commonMistake ?? "", 24], [item.code, 16],
  ];
  let score = 0;
  let matched = 0;
  for (const token of tokens) {
    const tokenScore = Math.max(...fields.map(([value, weight]) => weightedFieldScore(value, token, weight)));
    if (tokenScore > 0) {
      matched += 1;
      score += tokenScore;
    }
  }
  if (!matched || (tokens.length > 1 && matched / tokens.length < .5)) return -1;
  const phrase = normalizePythonCheatQuery(stripPythonQueryFiller(query));
  const primary = normalizePythonCheatQuery(`${item.action} ${item.title} ${item.aliases.join(" ")}`);
  if (phrase && primary.includes(phrase)) score += 220;
  return score + (matched / tokens.length) * 100 - (tokens.length - matched) * 30;
}

export function pythonCheatMatches(item: PythonCheatItem, query: string) {
  const tokens = pythonCheatQueryTerms(query);
  if (!tokens.length) return true;
  const searchable = normalizePythonCheatQuery(pythonCheatSearchText(item));
  return tokens.every((token) => (
    pythonQueryVariants(token).some((variant) => searchable.includes(variant))
    || fuzzyWordMatch(searchable, token)
  ));
}
