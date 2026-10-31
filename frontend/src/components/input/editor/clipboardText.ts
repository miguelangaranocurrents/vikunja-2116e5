import {getText, getTextSerializersFromSchema} from '@tiptap/core'
import type {Fragment, Node as ProseMirrorNode, Schema, Slice} from '@tiptap/pm/model'

type TextSerializers = ReturnType<typeof getTextSerializersFromSchema>

// Prefixes the first line with the marker and aligns the following lines under it.
function prefixLines(text: string, marker: string): string {
	const pad = ' '.repeat(marker.length)
	return text
		.split('\n')
		.map((line, i) => (i === 0 ? marker + line : (line === '' ? line : pad + line)))
		.join('\n')
}

function serializeListItem(item: ProseMirrorNode, marker: string, serializers: TextSerializers): string {
	const children: string[] = []
	item.forEach(child => {
		children.push(serializeNode(child, serializers))
	})
	return prefixLines(children.join('\n'), marker)
}

function serializeNode(node: ProseMirrorNode, serializers: TextSerializers): string {
	switch (node.type.name) {
		case 'bulletList':
		case 'orderedList':
		case 'taskList': {
			const start = Number(node.attrs.start ?? 1)
			const items: string[] = []
			node.forEach((item, _offset, index) => {
				let marker = '- '
				if (node.type.name === 'orderedList') {
					marker = `${start + index}. `
				} else if (node.type.name === 'taskList') {
					marker = item.attrs.checked ? '- [x] ' : '- [ ] '
				}
				items.push(serializeListItem(item, marker, serializers))
			})
			return items.join('\n')
		}
		default:
			if (node.isText) {
				return node.text ?? ''
			}
			if (node.isInline || node.isLeaf) {
				return node.textContent
			}
			if (node.isTextblock) {
				return getText(node, {blockSeparator: '\n', textSerializers: serializers})
			}
			return serializeFragment(node.content, serializers)
	}
}

function serializeFragment(fragment: Fragment, serializers: TextSerializers): string {
	const blocks: string[] = []
	let inline = ''
	fragment.forEach(node => {
		if (node.isInline) {
			inline += serializeNode(node, serializers)
			return
		}
		if (inline !== '') {
			blocks.push(inline)
			inline = ''
		}
		blocks.push(serializeNode(node, serializers))
	})
	if (inline !== '') {
		blocks.push(inline)
	}
	return blocks.join('\n\n')
}

/**
 * Serializes copied content to plain text, keeping list markers so lists stay
 * recognizable when pasted outside the editor.
 */
export function createClipboardTextSerializer(schema: Schema) {
	const serializers = getTextSerializersFromSchema(schema)
	return (slice: Slice) => serializeFragment(slice.content, serializers)
}
