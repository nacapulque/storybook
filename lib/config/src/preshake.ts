import { generate } from 'astring';
import { parse, AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';

const preshake = (raw: string, allowed: string[]): string => {
  const options = {
    range: false,
    loc: false,
    comment: false,
    jsx: true,
    useJSXTextNode: true,
  };
  const ast = parse(raw, options);

  ast.body = ast.body.filter(i => {
    // export function a() {}
    // export interface Bang {}
    // export type Foo = string | number;
    if (
      i.type === AST_NODE_TYPES.ExportNamedDeclaration &&
      (i.declaration.type === AST_NODE_TYPES.TSTypeAliasDeclaration ||
        i.declaration.type === AST_NODE_TYPES.FunctionDeclaration ||
        i.declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration)
    ) {
      return allowed.includes(i.declaration.id.name);
    }

    // export const manager = {};
    // export const {f,g: h} = {f: 4, g:5};
    if (
      i.type === AST_NODE_TYPES.ExportNamedDeclaration &&
      i.declaration.type === AST_NODE_TYPES.VariableDeclaration
    ) {
      // MUTATION!
      i.declaration.declarations = i.declaration.declarations.filter(d => {
        if (d.id.type === AST_NODE_TYPES.ObjectPattern) {
          // MUTATION!
          d.id.properties = d.id.properties.filter(
            p =>
              p.type === AST_NODE_TYPES.Property &&
              p.value.type === AST_NODE_TYPES.Identifier &&
              allowed.includes(p.value.name)
          );
          return !!d.id.properties.length;
        }
        if (d.id.type === AST_NODE_TYPES.Identifier) {
          return allowed.includes(d.id.name);
        }
        return false;
      }, []);

      return !!i.declaration.declarations.length;
    }

    // export { n as b, m as c };
    if (i.type === AST_NODE_TYPES.ExportNamedDeclaration && i.specifiers) {
      return false;
    }

    // export default class Foo {};
    // @ts-ignore (remove after https://github.com/typescript-eslint/typescript-eslint/pull/378 is merged)
    if (i.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
      throw new Error('ExportAllDeclaration is not supported in Storybook config');
      /* This is not supported because we don't have a config property called 'default' */
    }

    // export * from 'foo';
    if (i.type === AST_NODE_TYPES.ExportAllDeclaration) {
      throw new Error('ExportDefaultDeclaration is not supported in Storybook config');
      /* This is not supported because we'd have to recurse into the modules which would add a lot of complexity */
      /* The solution is the make exports explicit */
    }
    return true;
  }, []);

  // @ts-ignore (typescript-eslint => estree)
  return generate(ast);
};

export { preshake };