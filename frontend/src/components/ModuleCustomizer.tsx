import { useState } from "react";

import {
  compileLayoutInstruction,
  type LayoutOperation,
  type ModuleComponentDefinition,
  type ModuleLayoutConfig,
} from "../modules/moduleConfig";

type Props = {
  moduleTitle: string;
  components: ModuleComponentDefinition[];
  config: ModuleLayoutConfig;
  canUndo: boolean;
  onApply: (operations: LayoutOperation[]) => void;
  onUndo: () => void;
};

const examples = [
  "把今日学习放到最上面",
  "隐藏 JavaScript 课程",
  "显示课程与参考",
];

export function ModuleCustomizer({ moduleTitle, components, config, canUndo, onApply, onUndo }: Props) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<LayoutOperation[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const preparePreview = () => {
    const compiled = compileLayoutInstruction(instruction, components);
    setPreview(compiled.operations);
    setErrors(compiled.errors);
  };

  const applyPreview = () => {
    if (!preview.length) return;
    onApply(preview);
    setInstruction("");
    setPreview([]);
    setErrors([]);
  };

  return (
    <section className={`module-customizer${open ? " open" : ""}`} aria-label={`Customize ${moduleTitle}`}>
      <div className="module-customizer-bar">
        <div>
          <span>LOCAL CONFIGURATION AGENT</span>
          <b>{moduleTitle}</b>
        </div>
        <div>
          <button type="button" disabled={!canUndo} onClick={onUndo}>UNDO</button>
          <button className="customize-trigger" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
            {open ? "CLOSE" : "CUSTOMIZE WITH AI"}
          </button>
        </div>
      </div>

      {open && (
        <div className="module-customizer-body">
          <div className="module-customizer-copy">
            <p>Describe the result. The agent can only use registered components and validated layout actions.</p>
            <div className="module-component-map">
              {config.order.map((id) => {
                const component = components.find((item) => item.id === id);
                if (!component) return null;
                const visible = !config.hidden.includes(id);
                return (
                  <button
                    className={visible ? "" : "hidden"}
                    type="button"
                    title={component.description}
                    onClick={() => onApply([{
                      type: "visibility",
                      componentId: id,
                      visible: !visible,
                      summary: `${visible ? "隐藏" : "显示"} ${component.label}`,
                    }])}
                    key={id}
                  >
                    <span>{visible ? "●" : "○"}</span>{component.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="module-agent-command">
            <label htmlFor="learning-customize-command">Tell the agent what to change</label>
            <textarea
              id="learning-customize-command"
              value={instruction}
              onChange={(event) => {
                setInstruction(event.target.value);
                setPreview([]);
                setErrors([]);
              }}
              placeholder="例如：把今日学习放到最上面，隐藏课程与参考"
            />
            <div className="module-command-examples">
              {examples.map((example) => <button type="button" onClick={() => setInstruction(example)} key={example}>{example}</button>)}
            </div>
            <button className="preview-button" type="button" disabled={!instruction.trim()} onClick={preparePreview}>PREVIEW CHANGES</button>
          </div>

          {(preview.length > 0 || errors.length > 0) && (
            <div className="module-change-preview" aria-live="polite">
              <p>PROPOSED LOCAL CHANGES</p>
              {preview.map((operation, index) => <div className="valid" key={`${operation.componentId}-${index}`}><span>+</span>{operation.summary}</div>)}
              {errors.map((error) => <div className="invalid" key={error}><span>!</span>{error}</div>)}
              {preview.length > 0 && <button type="button" onClick={applyPreview}>APPLY {preview.length} CHANGE{preview.length === 1 ? "" : "S"}</button>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
