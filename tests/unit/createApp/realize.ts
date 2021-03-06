import global from 'dojo-core/global';
import has from 'dojo-core/has';
import Promise from 'dojo-shim/Promise';
import createActualWidget from 'dojo-widgets/createWidget';
import createContainer from 'dojo-widgets/createContainer';
import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';

import createApp, {
	App,
	ActionLike,
	RegistryProvider,
	StoreLike
} from 'src/createApp';

import {
	createAction,
	createStore,
	createWidget,
	rejects,
	strictEqual
} from '../../support/createApp';

function opts (obj: any) {
	return JSON.stringify(obj).replace(/"/g, '&quot;');
}

let app: App = null;
let root: HTMLElement = null;
let projector: HTMLElement = null;
let stubbedGlobals = false;

registerSuite({
	name: 'createApp#realize',

	before() {
		if (has('host-node')) {
			global.document = (<any> require('jsdom')).jsdom('<html><body></body></html>');
			global.Node = global.document.defaultView.Node;
			stubbedGlobals = true;
		}
	},

	after() {
		if (stubbedGlobals) {
			delete global.document;
			delete global.Node;
		}
	},

	beforeEach() {
		root = document.createElement('div');
		projector = document.createElement('widget-projector');
		root.appendChild(projector);
		app = createApp();
	},

	'recognizes custom elements by tag name'() {
		app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
		projector.innerHTML = '<widget-instance id="foo"></widget-instance>';
		return app.realize(root).then(() => {
			assert.equal(projector.firstChild.nodeName, 'MARK');
		});
	},

	'tag name comparisons are case-insensitive'() {
		app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
		projector.innerHTML = '<widget-instance id="foo"></widget-instance>';
		return app.realize(root).then(() => {
			assert.equal(projector.firstChild.nodeName, 'MARK');
		});
	},

	'tag name takes precedence over `is` attribute'() {
		app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
		projector.innerHTML = '<widget-instance is="widget-projector" id="foo"></widget-instance>';
		return app.realize(root).then(() => {
			assert.equal(root.firstChild.firstChild.nodeName, 'MARK');
		});
	},

	'`is` attribute comparison is case-insensitive'() {
		app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
		projector.innerHTML = '<div is="widget-instance" id="foo"></div>';
		return app.realize(root).then(() => {
			assert.equal(projector.firstChild.nodeName, 'MARK');
		});
	},

	'skips unknown custom elements'() {
		root.innerHTML = '<custom-element></custom-element><div is="another-element"></div>';
		return app.realize(root).then(() => {
			assert.equal(root.firstChild.nodeName, 'CUSTOM-ELEMENT');
			assert.equal(root.lastChild.nodeName, 'DIV');
		});
	},

	'custom elements must be rooted in a widget-projector'() {
		root.innerHTML = '<widget-instance id="foo"/>';
		return rejects(app.realize(root), Error, 'Custom tags must be rooted in a widget-projector');
	},

	'the widget-projector element is left in the DOM'() {
		app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
		projector.innerHTML = '<widget-instance id="foo"></widget-instance>';
		return app.realize(root).then(() => {
			assert.strictEqual(root.firstChild, projector);
		});
	},

	'the widget-projector element may be the root'() {
		app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
		projector.innerHTML = '<widget-instance id="foo"></widget-instance>';
		return app.realize(projector).then(() => {
			assert.equal(projector.firstChild.nodeName, 'MARK');
		});
	},

	'widget-projector elements cannot contain other widget-projector elements'() {
		app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
		projector.innerHTML = '<widget-projector></widget-projector>';
		return rejects(app.realize(root), Error, 'widget-projector cannot contain another widget-projector');
	},

	'realized elements are replaced'() {
		app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
		app.registerWidget('bar', createActualWidget({ tagName: 'strong' }));
		projector.innerHTML = `
			before1
			<widget-instance id="foo"></widget-instance>
			<div>
				before2
				<widget-instance id="bar"></widget-instance>
				after2
			</div>
			after1
		`.trim();
		return app.realize(root).then(() => {
			const before1 = projector.firstChild;
			assert.equal(before1.nodeValue.trim(), 'before1');
			const foo = <Element> before1.nextSibling;
			assert.equal(foo.nodeName, 'MARK');
			const div = foo.nextElementSibling;
			assert.equal(div.nodeName, 'DIV');
			const before2 = div.firstChild;
			assert.equal(before2.nodeValue.trim(), 'before2');
			const bar = before2.nextSibling;
			assert.equal(bar.nodeName, 'STRONG');
			const after2 = bar.nextSibling;
			assert.equal(after2.nodeValue.trim(), 'after2');
			const after1 = div.nextSibling;
			assert.equal(after1.nodeValue.trim(), 'after1');
		});
	},

	'supports multiple projection projectors'() {
		app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
		app.registerWidget('bar', createActualWidget({ tagName: 'strong' }));
		root.innerHTML = `
			<widget-projector><widget-instance id="foo"></widget-instance></widget-projector>
			<widget-projector><widget-instance id="bar"></widget-instance></widget-projector>
		`.trim();
		return app.realize(root).then(() => {
			assert.equal(root.firstChild.firstChild.nodeName, 'MARK');
			assert.equal(root.lastChild.firstChild.nodeName, 'STRONG');
		});
	},

	'<widget-instance> custom elements': {
		'data-widget-id takes precedence over id'() {
			app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
			projector.innerHTML = '<widget-instance id="bar" data-widget-id="foo"></widget-instance>';
			return app.realize(root).then(() => {
				assert.equal(projector.firstChild.nodeName, 'MARK');
			});
		},

		'an ID is required'() {
			projector.innerHTML = '<widget-instance></widget-instance>';
			return rejects(app.realize(root), Error, 'Cannot resolve widget for a custom element without \'data-widget-id\' or \'id\' attributes');
		},

		'the ID must resolve to a widget instance'() {
			projector.innerHTML = '<widget-instance id="foo"></widget-instance>';
			return rejects(app.realize(root), Error, 'Could not find a value for identity \'foo\'');
		}
	},

	'realizes registered custom elements'() {
		app.registerCustomElementFactory('foo-bar', () => createActualWidget({ tagName: 'mark' }));
		projector.innerHTML = '<foo-bar></foo-bar>';
		return app.realize(root).then(() => {
			assert.equal(projector.firstChild.nodeName, 'MARK');
		});
	},

	'child nodes of custom elements that are not custom elements themselves are discarded'() {
		app.registerCustomElementFactory('foo-bar', () => createActualWidget({ tagName: 'mark' }));
		projector.innerHTML = '<foo-bar>oh noes</foo-bar>';
		return app.realize(root).then(() => {
			assert.equal(projector.firstChild.nodeName, 'MARK');
			assert.isFalse(projector.firstChild.hasChildNodes());
		});
	},

	'the rendered widget hierarchy reflects the nesting of custom elements'() {
		app.registerCustomElementFactory('container-here', () => createContainer());
		app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
		app.registerWidget('bar', createActualWidget({ tagName: 'strong' }));
		root.innerHTML = `
			<widget-projector>
				<container-here>
					<widget-instance id="foo"></widget-instance>
				</container-here>
			</widget-projector>
			<widget-projector>
				<container-here>
					<widget-instance id="bar"></widget-instance>
				</container-here>
			</widget-projector>
		`.trim();
		return app.realize(root).then(() => {
			const first = root.firstElementChild.firstElementChild;
			assert.equal(first.nodeName, 'DOJO-CONTAINER');
			assert.equal(first.firstChild.nodeName, 'MARK');

			const second = root.lastElementChild.firstElementChild;
			assert.equal(second.nodeName, 'DOJO-CONTAINER');
			assert.equal(second.firstChild.nodeName, 'STRONG');
		});
	},

	'the rendered widget hierarchy ignores non-custom elements'() {
		app.registerCustomElementFactory('container-here', () => createContainer());
		app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
		projector.innerHTML = `
			<container-here>
				<div>
					<widget-instance id="foo"></widget-instance>
				</div>
			</container-here>
		`.trim();
		return app.realize(root).then(() => {
			const container = projector.firstElementChild;
			assert.equal(container.nodeName, 'DOJO-CONTAINER');
			assert.equal(container.firstChild.nodeName, 'MARK');
		});
	},

	'a widget cannot be attached multiple times in the same projector'() {
		const widget = createActualWidget({ tagName: 'mark' });
		app.registerCustomElementFactory('foo-1', () => widget);
		app.registerCustomElementFactory('foo-2', () => widget);
		projector.innerHTML = `
			<foo-1></foo-1>
			<foo-2></foo-2>
		`;
		return rejects(app.realize(root), Error, 'Cannot attach a widget multiple times');
	},

	'a widget cannot be attached in multiple projectors'() {
		const widget = createActualWidget({ tagName: 'mark' });
		app.registerCustomElementFactory('foo-bar', () => widget);
		root.innerHTML = `
			<widget-projector><foo-bar></foo-bar></widget-projector>
			<widget-projector><foo-bar></foo-bar></widget-projector>
		`;
		return rejects(app.realize(root), Error, 'Cannot attach a widget multiple times');
	},

	'a widget cannot be attached in multiple realizations'() {
		const widget = createActualWidget({ tagName: 'mark' });
		app.registerCustomElementFactory('foo-bar', () => widget);
		projector.innerHTML = '<foo-bar></foo-bar>';
		const clone = <Element> projector.cloneNode(true);
		return rejects(
			Promise.all([
				app.realize(projector),
				app.realize(clone)
			]),
			Error,
			'Cannot attach a widget multiple times'
		);
	},

	'a widget cannot be attached if it already has a parent'() {
		const widget = createActualWidget({ tagName: 'mark' });
		createContainer().append(widget);
		app.registerWidget('foo', widget);
		projector.innerHTML = '<widget-instance id="foo"></widget-instance>';
		return rejects(app.realize(root), Error, 'Cannot attach a widget that already has a parent');
	},

	'custom elements are created with options': {
		'options come from the data-options attribute'() {
			let fooBar: { [p: string]: any } = null;
			let bazQux: { [p: string]: any } = null;
			app.registerCustomElementFactory('foo-bar', (options) => {
				fooBar = options;
				return createActualWidget({ tagName: 'mark' });
			});
			app.loadDefinition({
				customElements: [
					{
						name: 'baz-qux',
						factory(options) {
							bazQux = options;
							return createActualWidget({ tagName: 'strong' });
						}
					}
				]
			});
			projector.innerHTML = `
				<foo-bar data-options="${opts({ foo: 'bar', baz: 5 })}"></foo-bar>
				<baz-qux data-options="${opts({ qux: 'quux', thud: 42 })}"></baz-qux>
			`;
			return app.realize(root).then(() => {
				assert.isOk(fooBar);
				assert.equal(fooBar['foo'], 'bar');
				assert.equal(fooBar['baz'], 5);
				assert.isOk(bazQux);
				assert.equal(bazQux['qux'], 'quux');
				assert.equal(bazQux['thud'], 42);
			});
		},

		'realization fails if the data-options value is not valid JSON'() {
			app.registerCustomElementFactory('foo-bar', createWidget);
			projector.innerHTML = `<foo-bar data-options="${opts({}).slice(1)}"></foo-bar>`;
			return rejects(app.realize(root), SyntaxError).then((err) => {
				assert.match(err.message, /^Invalid data-options:/);
				assert.match(err.message, / \(in "}"\)$/);
			});
		},

		'realization fails if the data-options value does not encode an object'() {
			app.registerCustomElementFactory('foo-bar', createWidget);
			projector.innerHTML = `<foo-bar data-options="${opts(null)}"></foo-bar>`;
			return rejects(app.realize(root), TypeError, 'Expected object from data-options (in "null")').then(() => {
				projector.innerHTML = `<foo-bar data-options="${opts(42)}"></foo-bar>`;
				return rejects(app.realize(root), TypeError, 'Expected object from data-options (in "42")');
			});
		},

		'the "registryProvider" option must not be present in data-options'() {
			app.registerCustomElementFactory('foo-bar', createWidget);
			projector.innerHTML = `<foo-bar data-options="${opts({ registryProvider: {} })}"></foo-bar>`;
			return rejects(app.realize(root), Error, 'Unexpected registryProvider value in data-options (in "{\\"registryProvider\\":{}}")');
		},

		'the "registryProvider" option is provided to the factory'() {
			let actual: { registryProvider: RegistryProvider } = null;
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = <any> options;
				return createActualWidget({ tagName: 'mark' });
			});
			projector.innerHTML = `<foo-bar></foo-bar>`;
			return app.realize(root).then(() => {
				assert.isOk(actual);
				assert.strictEqual(actual.registryProvider, app.registryProvider);
			});
		},

		'if present, the "stateFrom" option': {
			'must be a string'() {
				app.registerCustomElementFactory('foo-bar', createWidget);
				projector.innerHTML = `<foo-bar data-options="${opts({ stateFrom: 5 })}"></foo-bar>`;
				return rejects(app.realize(root), TypeError, 'Expected stateFrom value in data-options to be a non-empty string (in "{\\"stateFrom\\":5}")');
			},

			'must be a non-empty string'() {
				app.registerCustomElementFactory('foo-bar', createWidget);
				projector.innerHTML = `<foo-bar data-options="${opts({ stateFrom: '' })}"></foo-bar>`;
				return rejects(app.realize(root), TypeError, 'Expected stateFrom value in data-options to be a non-empty string (in "{\\"stateFrom\\":\\"\\"}")');
			},

			'must identify a registered store'() {
				app.registerCustomElementFactory('foo-bar', createWidget);
				projector.innerHTML = `<foo-bar data-options="${opts({ stateFrom: 'store' })}"></foo-bar>`;
				return rejects(app.realize(root), Error);
			},

			'causes the custom element factory to be called with a stateFrom option set to the store'() {
				let actual: { stateFrom: StoreLike } = null;
				app.registerCustomElementFactory('foo-bar', (options) => {
					actual = <any> options;
					return createActualWidget({ tagName: 'mark' });
				});
				const expected = createStore();
				app.registerStore('store', expected);
				projector.innerHTML = `<foo-bar data-options="${opts({ stateFrom: 'store' })}"></foo-bar>`;
				return app.realize(root).then(() => {
					assert.isOk(actual);
					assert.strictEqual(actual.stateFrom, expected);
				});
			},

			'takes precedence over data-state-from'() {
				let actual: { stateFrom: StoreLike } = null;
				app.registerCustomElementFactory('foo-bar', (options) => {
					actual = <any> options;
					return createActualWidget({ tagName: 'mark' });
				});
				const expected = createStore();
				app.registerStore('store', expected);
				app.registerStore('otherStore', createStore());
				projector.innerHTML = `<foo-bar data-state-from="otherStore" data-options="${opts({ stateFrom: 'store' })}"></foo-bar>`;
				return app.realize(root).then(() => {
					assert.isOk(actual);
					assert.strictEqual(actual.stateFrom, expected);
				});
			},

			'takes precedence over <widget-projector data-state-from>'() {
				let actual: { stateFrom: StoreLike } = null;
				app.registerCustomElementFactory('foo-bar', (options) => {
					actual = <any> options;
					return createActualWidget({ tagName: 'mark' });
				});
				const expected = createStore();
				app.registerStore('store', expected);
				app.registerStore('otherStore', createStore());
				projector.setAttribute('data-state-from', 'otherStore');
				projector.innerHTML = `<foo-bar data-options="${opts({ stateFrom: 'store' })}"></foo-bar>`;
				return app.realize(root).then(() => {
					assert.isOk(actual);
					assert.strictEqual(actual.stateFrom, expected);
				});
			},

			'takes precedence over the default store'() {
				const app = createApp({ defaultStore: createStore() });
				let actual: { stateFrom: StoreLike } = null;
				app.registerCustomElementFactory('foo-bar', (options) => {
					actual = <any> options;
					return createActualWidget({ tagName: 'mark' });
				});
				const expected = createStore();
				app.registerStore('store', expected);
				projector.innerHTML = `<foo-bar data-options="${opts({ stateFrom: 'store' })}"></foo-bar>`;
				return app.realize(root).then(() => {
					assert.isOk(actual);
					assert.strictEqual(actual.stateFrom, expected);
				});
			}
		},

		'if present, the "listeners" option': {
			'must be an object (not null)'() {
				app.registerCustomElementFactory('foo-bar', createWidget);
				projector.innerHTML = `<foo-bar data-options="${opts({ listeners: null })}"></foo-bar>`;
				return rejects(
					app.realize(root),
					TypeError,
					'Expected listeners value in data-options to be a widget listeners map with action identifiers (in "{\\"listeners\\":null}")'
				).then(() => {
					projector.innerHTML = `<foo-bar data-options="${opts({ listeners: 42 })}"></foo-bar>`;
					return rejects(
						app.realize(root),
						TypeError,
						'Expected listeners value in data-options to be a widget listeners map with action identifiers (in "{\\"listeners\\":42}")');
				});
			},

			'property values must be strings or arrays of strings'() {
				app.registerCustomElementFactory('foo-bar', createWidget);
				projector.innerHTML = `<foo-bar data-options="${opts({
					listeners: {
						type: 5
					}
				})}"></foo-bar>`;
				return rejects(
					app.realize(root),
					TypeError,
					'Expected listeners value in data-options to be a widget listeners map with action identifiers (in "{\\"listeners\\":{\\"type\\":5}}")'
				).then(() => {
					projector.innerHTML = `<foo-bar data-options="${opts({
						listeners: {
							type: [true]
						}
					})}"></foo-bar>`;
					return rejects(
						app.realize(root),
						TypeError,
						'Expected listeners value in data-options to be a widget listeners map with action identifiers (in "{\\"listeners\\":{\\"type\\":[true]}}")'
					);
				});
			},

			'the strings must identify registered actions'() {
				app.registerCustomElementFactory('foo-bar', createWidget);
				projector.innerHTML = `<foo-bar data-options="${opts({
					listeners: {
						type: 'action'
					}
				})}"></foo-bar>`;
				return rejects(app.realize(root), Error);
			},

			'causes the custom element factory to be called with a listeners map for the actions'() {
				let actual: { listeners: { [type: string]: ActionLike | ActionLike[] } } = null;
				app.registerCustomElementFactory('foo-bar', (options) => {
					actual = <any> options;
					return createActualWidget({ tagName: 'mark' });
				});
				const expected = createAction();
				app.registerAction('action', expected);
				projector.innerHTML = `<foo-bar data-options="${opts({
					listeners: {
						string: 'action',
						array: ['action']
					}
				})}"></foo-bar>`;
				return app.realize(root).then(() => {
					assert.isNotNull(actual);
					assert.strictEqual(actual.listeners['string'], expected);
					assert.lengthOf(actual.listeners['array'], 1);
					assert.strictEqual((<ActionLike[]> actual.listeners['array'])[0], expected);
				});
			}
		}
	},

	'non-projector data-state-from attribute': {
		'is ignored if empty'() {
			let actual: { stateFrom: StoreLike } = null;
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = <any> options;
				return createActualWidget({ tagName: 'mark' });
			});
			projector.innerHTML = `<foo-bar data-state-from="" id="foo"></foo-bar>`;
			return app.realize(root).then(() => {
				assert.isOk(actual);
				assert.notProperty(actual, 'stateFrom');
			});
		},

		'must identify a registered store'() {
			app.registerCustomElementFactory('foo-bar', createWidget);
			projector.innerHTML = `<foo-bar data-state-from="store" id="foo"></foo-bar>`;
			return rejects(app.realize(root), Error);
		},

		'if the element has an ID, causes the custom element factory to be called with a stateFrom option set to the store'() {
			let actual: { stateFrom: StoreLike } = null;
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = <any> options;
				return createActualWidget({ tagName: 'mark' });
			});
			const expected = createStore();
			app.registerStore('store', expected);
			projector.innerHTML = `<foo-bar data-state-from="store" id="foo"></foo-bar>`;
			return app.realize(root).then(() => {
				assert.isOk(actual);
				assert.strictEqual(actual.stateFrom, expected);
			});
		},

		'takes precedence over <widget-projector data-state-from>'() {
			let actual: { stateFrom: StoreLike } = null;
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = <any> options;
				return createActualWidget({ tagName: 'mark' });
			});
			const expected = createStore();
			app.registerStore('store', expected);
			app.registerStore('otherStore', createStore());
			projector.setAttribute('data-state-from', 'otherStore');
			projector.innerHTML = `<foo-bar data-state-from="store" id="foo"></foo-bar>`;
			return app.realize(root).then(() => {
				assert.isOk(actual);
				assert.strictEqual(actual.stateFrom, expected);
			});
		},

		'takes precedence over the default store'() {
			let actual: { stateFrom: StoreLike } = null;
			const app = createApp({ defaultStore: createStore() });
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = <any> options;
				return createActualWidget({ tagName: 'mark' });
			});
			const expected = createStore();
			app.registerStore('store', expected);
			projector.innerHTML = `<foo-bar data-state-from="store" id="foo"></foo-bar>`;
			return app.realize(root).then(() => {
				assert.isOk(actual);
				assert.strictEqual(actual.stateFrom, expected);
			});
		},

		'is ignored if the element does not have an ID'() {
			let actual: { stateFrom: StoreLike } = null;
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = <any> options;
				return createActualWidget({ tagName: 'mark' });
			});
			app.registerStore('store', createStore());
			projector.innerHTML = `<foo-bar data-state-from="store" data-options="{}"></foo-bar>`;
			return app.realize(root).then(() => {
				assert.isOk(actual);
				assert.notProperty(actual, 'stateFrom');
			});
		}
	},

	'<widget-projector data-state-from> attribute': {
		'is ignored if empty'() {
			let actual: { stateFrom: StoreLike } = null;
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = <any> options;
				return createActualWidget({ tagName: 'mark' });
			});
			projector.setAttribute('data-state-from', '');
			projector.innerHTML = `<foo-bar id="foo"></foo-bar>`;
			return app.realize(root).then(() => {
				assert.isOk(actual);
				assert.notProperty(actual, 'stateFrom');
			});
		},

		'must identify a registered store'() {
			app.registerCustomElementFactory('foo-bar', createWidget);
			projector.setAttribute('data-state-from', 'store');
			projector.innerHTML = `<foo-bar id="foo"></foo-bar>`;
			return rejects(app.realize(root), Error);
		},

		'if descendant elements have an ID, causes their custom element factory to be called with a stateFrom option set to the store'() {
			let actual: { stateFrom: StoreLike } = null;
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = <any> options;
				return createActualWidget({ tagName: 'mark' });
			});
			const expected = createStore();
			app.registerStore('store', expected);
			projector.setAttribute('data-state-from', 'store');
			projector.innerHTML = `<foo-bar id="foo"></foo-bar>`;
			return app.realize(root).then(() => {
				assert.isOk(actual);
				assert.strictEqual(actual.stateFrom, expected);
			});
		},

		'takes precedence over the default store'() {
			let actual: { stateFrom: StoreLike } = null;
			const app = createApp({ defaultStore: createStore() });
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = <any> options;
				return createActualWidget({ tagName: 'mark' });
			});
			const expected = createStore();
			app.registerStore('store', expected);
			projector.setAttribute('data-state-from', 'store');
			projector.innerHTML = `<foo-bar id="foo"></foo-bar>`;
			return app.realize(root).then(() => {
				assert.isOk(actual);
				assert.strictEqual(actual.stateFrom, expected);
			});
		},

		'is ignored for descendant elements that do not have an ID'() {
			let actual: { stateFrom: StoreLike } = null;
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = <any> options;
				return createActualWidget({ tagName: 'mark' });
			});
			app.registerStore('store', createStore());
			projector.setAttribute('data-state-from', '');
			projector.innerHTML = `<foo-bar data-options="{}"></foo-bar>`;
			return app.realize(root).then(() => {
				assert.isOk(actual);
				assert.notProperty(actual, 'stateFrom');
			});
		}
	},

	'the app has a default store': {
		'if the element has an ID, causes the custom element factory to be called with a stateFrom option set to the store'() {
			let actual: { stateFrom: StoreLike } = null;
			const expected = createStore();
			const app = createApp({ defaultStore: expected });
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = <any> options;
				return createActualWidget({ tagName: 'mark' });
			});
			projector.innerHTML = `<foo-bar id="foo"></foo-bar>`;
			return app.realize(root).then(() => {
				assert.isOk(actual);
				assert.strictEqual(actual.stateFrom, expected);
			});
		}
	},

	'data-state attribute': {
		'realization fails if the data-state value is not valid JSON'() {
			app.registerCustomElementFactory('foo-bar', createActualWidget);
			app.registerStore('store', createStore());
			projector.innerHTML = '<foo-bar id="widget" data-state-from="store" data-state=\'}\'></foo-bar>';
			return rejects(app.realize(root), SyntaxError).then((err) => {
				assert.match(err.message, /^Invalid data-state:/);
				assert.match(err.message, / \(in "}"\)$/);
			});
		},

		'realization fails if the data-state value does not encode an object'() {
			app.registerCustomElementFactory('foo-bar', createActualWidget);
			app.registerStore('store', createStore());
			projector.innerHTML = '<foo-bar id="widget" data-state-from="store" data-state=\'null\'></foo-bar>';
			return rejects(app.realize(root), TypeError, 'Expected object from data-state (in "null")').then(() => {
				projector.innerHTML = '<foo-bar id="widget" data-state-from="store" data-state=\'42\'></foo-bar>';
				return rejects(app.realize(root), TypeError, 'Expected object from data-state (in "42")');
			});
		},

		'for widgets with an ID and stateFrom, patch the store with the state before creating the widget'() {
			let calls: string[] = [];
			let patchArgs: any[][] = [];

			const store = createStore();
			(<any> store).patch = (...args: any[]) => {
				calls.push('patch');
				patchArgs.push(args);
				return Promise.resolve();
			};

			app.registerCustomElementFactory('foo-bar', () => {
				calls.push('factory');
				return createActualWidget();
			});
			app.registerStore('store', store);

			projector.innerHTML = '<foo-bar id="widget" data-state-from="store" data-state=\'{"foo":"bar"}\'></foo-bar>';
			return app.realize(root).then(() => {
				assert.deepEqual(calls, ['patch', 'factory']);
				assert.deepEqual(patchArgs, [[{ foo: 'bar' }, { id: 'widget' }]]);
			});
		}
	},

	'destroying the returned handle': {
		'leaves the rendered elements in the DOM'() {
			app.registerCustomElementFactory('foo-bar', () => createActualWidget({ tagName: 'mark' }));
			root.innerHTML = '<widget-projector><foo-bar></foo-bar></widget-projector>';
			return app.realize(root).then((handle) => {
				handle.destroy();
				return new Promise((resolve) => { setTimeout(resolve, 50); });
			}).then(() => {
				assert.equal(root.firstChild.firstChild.nodeName, 'MARK');
			});
		},

		'destroys managed widgets'() {
			const managedWidget = createActualWidget({ tagName: 'mark' });
			const attachedWidget = createActualWidget({ tagName: 'strong' });
			app.registerCustomElementFactory('managed-widget', () => managedWidget);
			app.registerWidget('attached', attachedWidget);

			let destroyedManaged = false;
			managedWidget.own({ destroy() { destroyedManaged = true; }});
			let destroyedAttached = false;
			attachedWidget.own({ destroy() { destroyedAttached = true; }});

			projector.innerHTML = '<managed-widget></managed-widget><widget-instance id="attached></widget-instance>';
			return app.realize(root).then((handle) => {
				handle.destroy();

				assert.isTrue(destroyedManaged);
				assert.isFalse(destroyedAttached);
			});
		},

		'deregisters custom element instances'() {
			const managedWidget = createActualWidget({ tagName: 'mark' });
			app.registerCustomElementFactory('managed-widget', () => managedWidget);

			projector.innerHTML = '<managed-widget id="foo"></managed-widget>';
			return app.realize(root).then((handle) => {
				assert.isTrue(app.hasWidget('foo'));
				assert.equal(app.identifyWidget(managedWidget), 'foo');
				handle.destroy();
				assert.isFalse(app.hasWidget('foo'));
				assert.throws(() => app.identifyWidget(managedWidget));
			});
		},

		'a second time is a noop'() {
			app.registerWidget('foo', createActualWidget({ tagName: 'mark' }));
			projector.innerHTML = '<widget-instance id="foo"></widget-instance>';
			return app.realize(root).then((handle) => {
				handle.destroy();
				handle.destroy();
				return new Promise((resolve) => { setTimeout(resolve, 50); });
			}).then(() => {
				assert.equal(root.firstChild.firstChild.nodeName, 'MARK');
			});
		}
	},

	'identifying and retrieving widgets': {
		'via data-options'() {
			const fooBar = createActualWidget();
			app.registerCustomElementFactory('foo-bar', () => fooBar);
			projector.innerHTML = '<foo-bar data-options="{&quot;id&quot;:&quot;fooBar&quot;}"></foo-bar>';
			return app.realize(root).then(() => {
				assert.equal(app.identifyWidget(fooBar), 'fooBar');
			});
		},

		'via data-widget-id'() {
			const fooBar = createActualWidget();
			app.registerCustomElementFactory('foo-bar', () => fooBar);
			projector.innerHTML = '<foo-bar data-widget-id="fooBar"></foo-bar>';
			return app.realize(root).then(() => {
				assert.equal(app.identifyWidget(fooBar), 'fooBar');
			});
		},

		'via the id attribute'() {
			const fooBar = createActualWidget();
			app.registerCustomElementFactory('foo-bar', () => fooBar);
			projector.innerHTML = '<foo-bar id="fooBar"></foo-bar>';
			return app.realize(root).then(() => {
				assert.equal(app.identifyWidget(fooBar), 'fooBar');
			});
		},

		'data-options takes precedence over data-widget-id over id'() {
			const fooBar = createActualWidget();
			app.registerCustomElementFactory('foo-bar', () => fooBar);
			const bazQux = createActualWidget();
			app.registerCustomElementFactory('baz-qux', () => bazQux);
			projector.innerHTML = `
				<foo-bar data-widget-id="bazQux" data-options="{&quot;id&quot;:&quot;fooBar&quot;}"></foo-bar>
				<baz-qux id="fooBar" data-widget-id="bazQux"></baz-qux>
			`;
			return app.realize(root).then(() => {
				assert.equal(app.identifyWidget(fooBar), 'fooBar');
				assert.equal(app.identifyWidget(bazQux), 'bazQux');
			});
		},

		'ID from data-widget-id is added to the creation options'() {
			let actual: string;
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = (<any> options).id;
				return createActualWidget();
			});
			projector.innerHTML = '<foo-bar data-widget-id="the-id"></foo-bar>';
			return app.realize(root).then(() => {
				assert.equal(actual, 'the-id');
			});
		},

		'ID from id is added to the creation options'() {
			let actual: string;
			app.registerCustomElementFactory('foo-bar', (options) => {
				actual = (<any> options).id;
				return createActualWidget();
			});
			projector.innerHTML = '<foo-bar id="the-id" data-options="{}"></foo-bar>';
			return app.realize(root).then(() => {
				assert.equal(actual, 'the-id');
			});
		},

		'IDs must be unique within the realization'() {
			app.registerCustomElementFactory('foo-bar', () => createActualWidget());
			projector.innerHTML = `
				<foo-bar id="unique"></foo-bar>
				<foo-bar id="unique"></foo-bar>
			`;
			return rejects(app.realize(root), Error, 'A widget with ID \'unique\' already exists');
		},

		'IDs must be unique within the application'() {
			app.registerCustomElementFactory('foo-bar', () => createActualWidget());
			app.registerWidget('unique', createWidget());
			projector.innerHTML = `
				<foo-bar id="unique"></foo-bar>
			`;
			return rejects(app.realize(root), Error, 'A widget with ID \'unique\' already exists');
		},

		'widgets without IDs can still be identified'() {
			const widget = createActualWidget();
			app.registerCustomElementFactory('foo-bar', () => widget);
			projector.innerHTML = '<foo-bar></foo-bar>';
			return app.realize(root).then(() => {
				const id = app.identifyWidget(widget);
				assert(id && typeof id === 'string');
			});
		},

		'hasWidget() returns true for custom element instances'() {
			const widget = createActualWidget();
			app.registerCustomElementFactory('foo-bar', () => widget);
			projector.innerHTML = '<foo-bar id="foo"></foo-bar>';
			return app.realize(root).then(() => {
				assert.isTrue(app.hasWidget('foo'));
			});
		},

		'getWidget() returns custom element instances'() {
			const widget = createActualWidget();
			app.registerCustomElementFactory('foo-bar', () => widget);
			projector.innerHTML = '<foo-bar id="foo"></foo-bar>';
			return app.realize(root).then(() => {
				return strictEqual(app.getWidget('foo'), widget);
			});
		}
	}
});
