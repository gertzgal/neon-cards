/**
 * Reject the placer patterns that keep putting a hand, a slot row, or a button
 * outside the viewport. The table-fit engine does not use these names.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const PLACERS = new Set([
  'handLayout',
  'straightRow',
  'fittedRow',
  'layoutHand',
  'scrollToCard',
  'scrollIntoView',
])

const SCALE_CONST = /^(?:MIN_SHOWN|MIN_SHRINK|minVisible|minScale|FLIP7_PHONE_SCALE|FLIP7_DESKTOP_SCALE)$/

const SCALE_PARAMS = new Set(['startScale', 'minCard', 'minScale', 'minVisible'])

function isNumericScaleName(name, init) {
  if (SCALE_CONST.test(name)) return true
  return /_SCALE$/.test(name) && init !== null && init !== undefined && init.type === 'Literal' && typeof init.value === 'number'
}

/** @param {import('estree').Node} node */
function namedId(node) {
  if (node.type === 'Identifier') return node
  if (node.type === 'AssignmentPattern') return namedId(node.left)
  if (node.type === 'RestElement') return namedId(node.argument)
  return null
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Reject hand-tuned card sizes, fit scales, and scroll-into-view outside the table-fit engine.',
    },
    schema: [],
    messages: {
      placer: 'Hand-tuned placer "{{name}}" sits outside the table-fit engine.',
      scaleConst: 'Card-size constant "{{name}}" sits outside the table-fit engine.',
      scaleParam: 'Fit input "{{name}}" lets a caller pick a card size.',
      scrolls: 'A row that must fit cannot set "scrolls".',
    },
  },
  create(context) {
    /**
     * @param {import('estree').Node} node
     * @param {string | undefined} name
     * @param {import('estree').Node | null | undefined} [init]
     */
    function checkName(node, name, init) {
      if (!name) return
      if (PLACERS.has(name)) {
        context.report({ node, messageId: 'placer', data: { name } })
      }
      if (isNumericScaleName(name, init ?? null)) {
        context.report({ node, messageId: 'scaleConst', data: { name } })
      }
    }

    /** @param {import('estree').Node} node */
    function checkParam(node) {
      const id = namedId(node)
      if (id && SCALE_PARAMS.has(id.name)) {
        context.report({ node: id, messageId: 'scaleParam', data: { name: id.name } })
      }
    }

    /**
     * @param {import('estree').FunctionDeclaration | import('estree').FunctionExpression | import('estree').ArrowFunctionExpression} node
     */
    function checkFunction(node) {
      if ('id' in node && node.id) checkName(node.id, node.id.name)
      for (const param of node.params) checkParam(param)
    }

    /** @param {import('estree').Node | null | undefined} key */
    function checkScrolls(node, key) {
      if (key && key.type === 'Identifier' && key.name === 'scrolls') {
        context.report({ node, messageId: 'scrolls' })
      }
    }

    return {
      FunctionDeclaration(node) {
        checkFunction(node)
      },
      FunctionExpression(node) {
        checkFunction(node)
      },
      ArrowFunctionExpression(node) {
        checkFunction(node)
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier') checkName(node.id, node.id.name, node.init)
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier') checkName(node.callee, node.callee.name)
        if (
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.property.type === 'Identifier'
        ) {
          const name = node.callee.property.name
          if (name === 'scrollIntoView' || name === 'scrollTo' || name === 'scrollToCard') {
            context.report({ node: node.callee.property, messageId: 'placer', data: { name } })
          }
        }
      },
      Property(node) {
        if (!node.computed) checkScrolls(node, node.key)
      },
      TSPropertySignature(node) {
        checkScrolls(node, node.key)
      },
    }
  },
}
