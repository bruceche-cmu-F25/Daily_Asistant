export type ModuleComponentDefinition = {
  id: string;
  label: string;
  description: string;
  aliases: string[];
};

export type ModuleLayoutConfig = {
  version: 1;
  order: string[];
  hidden: string[];
};

export type LayoutOperation =
  | { type: "visibility"; componentId: string; visible: boolean; summary: string }
  | { type: "move"; componentId: string; position: "first" | "last"; summary: string };

export type CompiledLayoutInstruction = {
  operations: LayoutOperation[];
  errors: string[];
};

const hideWords = /隐藏|移除|不要显示|hide|remove/i;
const showWords = /显示|恢复|加入|添加|add|show|restore/i;
const firstWords = /最上面|最前面|顶部|第一个|置顶|move.*top|move.*first|at the top/i;
const lastWords = /最下面|最后面|底部|最后一个|move.*bottom|move.*last|at the bottom/i;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function findComponent(clause: string, definitions: ModuleComponentDefinition[]) {
  const normalized = normalize(clause);
  const aliases = definitions
    .flatMap((definition) => [definition.label, ...definition.aliases].map((alias) => ({ alias: normalize(alias), definition })))
    .sort((left, right) => right.alias.length - left.alias.length);
  return aliases.find(({ alias }) => alias && normalized.includes(alias))?.definition;
}

export function normalizeLayoutConfig(
  value: Partial<ModuleLayoutConfig> | null | undefined,
  definitions: ModuleComponentDefinition[],
): ModuleLayoutConfig {
  const validIds = definitions.map((definition) => definition.id);
  const requestedOrder = Array.isArray(value?.order) ? value.order.filter((id): id is string => validIds.includes(id)) : [];
  const order = [...new Set([...requestedOrder, ...validIds])];
  const hidden = Array.isArray(value?.hidden)
    ? [...new Set(value.hidden.filter((id): id is string => validIds.includes(id)))]
    : [];
  return { version: 1, order, hidden };
}

export function compileLayoutInstruction(
  instruction: string,
  definitions: ModuleComponentDefinition[],
): CompiledLayoutInstruction {
  const clauses = instruction
    .split(/(?:，|,|。|；|;|\n|然后|并且|and then)/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const operations: LayoutOperation[] = [];
  const errors: string[] = [];

  for (const clause of clauses) {
    const component = findComponent(clause, definitions);
    if (!component) {
      errors.push(`找不到这条指令对应的组件：“${clause}”`);
      continue;
    }

    if (hideWords.test(clause)) {
      operations.push({
        type: "visibility",
        componentId: component.id,
        visible: false,
        summary: `隐藏 ${component.label}`,
      });
      continue;
    }
    if (showWords.test(clause)) {
      operations.push({
        type: "visibility",
        componentId: component.id,
        visible: true,
        summary: `显示 ${component.label}`,
      });
      continue;
    }
    if (firstWords.test(clause)) {
      operations.push({
        type: "move",
        componentId: component.id,
        position: "first",
        summary: `把 ${component.label} 移到最上面`,
      });
      continue;
    }
    if (lastWords.test(clause)) {
      operations.push({
        type: "move",
        componentId: component.id,
        position: "last",
        summary: `把 ${component.label} 移到最下面`,
      });
      continue;
    }

    errors.push(`理解了组件“${component.label}”，但还不支持这个操作：“${clause}”`);
  }

  return { operations, errors };
}

export function applyLayoutOperations(config: ModuleLayoutConfig, operations: LayoutOperation[]): ModuleLayoutConfig {
  let order = [...config.order];
  let hidden = [...config.hidden];

  for (const operation of operations) {
    if (operation.type === "visibility") {
      hidden = operation.visible
        ? hidden.filter((id) => id !== operation.componentId)
        : [...new Set([...hidden, operation.componentId])];
      continue;
    }

    order = order.filter((id) => id !== operation.componentId);
    order = operation.position === "first"
      ? [operation.componentId, ...order]
      : [...order, operation.componentId];
  }

  return { ...config, order, hidden };
}
