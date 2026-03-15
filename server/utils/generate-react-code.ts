import { normalizeUIComponent, type UIComponent } from "../../shared/ui-schema.js";

const INDENT = "  ";

function indent(level: number): string {
  return INDENT.repeat(level);
}

function toJsxStringExpression(value: string): string {
  return `{${JSON.stringify(value)}}`;
}

function buildAttribute(name: string, value: string | undefined): string {
  if (!value) {
    return "";
  }

  return ` ${name}=${toJsxStringExpression(value)}`;
}

function renderChildren(children: UIComponent[] | undefined, level: number): string[] {
  if (!children || children.length === 0) {
    return [];
  }

  return children.map((child) => renderComponent(child, level));
}

function renderTextNode(text: string | undefined, level: number): string[] {
  if (!text) {
    return [];
  }

  return [`${indent(level)}${toJsxStringExpression(text)}`];
}

function renderComponent(component: UIComponent, level: number): string {
  const className = buildAttribute("className", component.style);

  switch (component.type) {
    case "Container": {
      const childLines = renderChildren(component.children, level + 1);
      if (childLines.length === 0) {
        return `${indent(level)}<div${className} />`;
      }

      return [
        `${indent(level)}<div${className}>`,
        ...childLines,
        `${indent(level)}</div>`,
      ].join("\n");
    }

    case "Text": {
      const contentLines = [
        ...renderTextNode(component.text, level + 1),
        ...renderChildren(component.children, level + 1),
      ];

      if (contentLines.length === 0) {
        return `${indent(level)}<span${className} />`;
      }

      return [
        `${indent(level)}<span${className}>`,
        ...contentLines,
        `${indent(level)}</span>`,
      ].join("\n");
    }

    case "Button": {
      const contentLines = [
        ...renderTextNode(component.text, level + 1),
        ...renderChildren(component.children, level + 1),
      ];

      if (contentLines.length === 0) {
        return `${indent(level)}<button type="button"${className} />`;
      }

      return [
        `${indent(level)}<button type="button"${className}>`,
        ...contentLines,
        `${indent(level)}</button>`,
      ].join("\n");
    }

    case "Input": {
      const placeholder = buildAttribute("placeholder", component.placeholder);
      const defaultValue = buildAttribute("defaultValue", component.text);
      return `${indent(level)}<input type="text"${className}${placeholder}${defaultValue} />`;
    }

    case "Image": {
      const src = buildAttribute("src", component.src);
      const alt = buildAttribute("alt", component.text ?? "Generated image");
      return `${indent(level)}<img${className}${src}${alt} />`;
    }
  }
}

export function generateReactCode(schema: any): string {
  const normalizedSchema = normalizeUIComponent(schema);
  if (!normalizedSchema) {
    throw new Error("Invalid UI schema payload.");
  }

  const jsx = renderComponent(normalizedSchema, 2);

  return [
    "export default function GeneratedApp() {",
    "  return (",
    jsx,
    "  );",
    "}",
  ].join("\n");
}
