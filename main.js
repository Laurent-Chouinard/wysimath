(function parseLatex () {
var N = 0
function tree(text) {
	var ancestors = [], buffer = ""
	var cur0, cur = []
	var _tree = cur

	function dump() {if (buffer) cur.push(buffer), buffer = ""}
	function open() {cur.push(cur0 = []); ancestors.push(cur);	cur = cur0;	}
	function close() {cur = ancestors.pop()}
	function accumulate() {buffer += char}

	var char, k = 0
	while(char = text.charAt(k++)) 
		switch (char) {
			case "{": dump(); open();	break;
			case "}":	dump(); close(); break;
			case " ": dump(); break;
			case "\\": accumulate(); break;
			default: buffer? accumulate(): cur.push(char)
		}

	var gag = 0, stopgag = 100
	function tree2(tree) {
		var i
		
		function frontMerge(n) {
			tree.splice(i, 0, tree.splice(i, n + 1))
		} 

		function midMerge() {
			var swap = tree.splice(i - 1, 3)
			swap = [1, 0, 2].map(j => swap[j])
			tree.splice(--i, 0, swap); 
		} 
		
		tree = tree.map(elem => Array.isArray(elem)? tree2(elem): elem)

		for (i = 0; i < tree.length && gag < stopgag; i++) {
			switch (tree[i]) {
				case "\\frac": frontMerge(2); break;
				case "\\sqrt": frontMerge(1); break;
				// case "\\sum"
				case "+": case "-":
				case "_": case "^": midMerge(); break;
			}
		}

		function unwrap(x) {
			return Array.isArray(x) && 1===x.length? x[0]: x
		}
		if (gag > stopgag) return []
		return unwrap(tree)
	}
	return tree2(_tree)
}

var tests = [
	{	
		input: "x_{\\frac{y_2}{y}^{\\sqrt {2+1}}}",
		expects: "[_, x, [^, [\\frac, [_, y, 2], y], [\\sqrt, [+, 2, 1]]]]"
	},
	{ 
		input: "\\frac{\\sqrt{\\sqrt{y_2}}}{\\sqrt y}^{\\sqrt {2+1+r}}",
		expects: "[^, [\\frac, [\\sqrt, [\\sqrt, [_, y, 2]]], "
			+ "[\\sqrt, y]], [\\sqrt, [+, [+, 2, 1], r]]]"
	},
	{ 
		input: "\\frac{u_a+w+x+y+z} {x_{\\frac{y_2}{y}}^{u_2+v}}",
		expects: "[\\frac, [+, [+, [+, [+, [_, u, a], w], x], y], z], "
			+ "[^, [_, x, [\\frac, [_, y, 2], y]], [+, [_, u, 2], v]]]"
	}
]

function texDiv(text) {
	var div = document.createElement("div")
	document.body.appendChild(div)
	katex.render(text, div)
	div.style = "background: #eee; width: 200px;"
	return div
}

tests.forEach(test)

function test(test, i) {
	texDiv(test.input)
	var result = rprint(tree(test.input))===test.expects? "réussi": "échoué"
	console.log(`test #${i+1} ${result}`)
	// console.log(rprint(tree(test.input)))
}
});
// })();

function rprint(array) {
	return `[${array.map(elem => 
		Array.isArray(elem)? rprint(elem): `${elem}`).join(", ")}]`
}

// (function ddeqDef () {}) ();

function trimCurlyBrackets(text) {
	// return text.charAt(0) === "{"? trimCurlyBrackets(text.slice(1,-1)): text
	var sub
	if (text.charAt(0) === "{" && text.charAt(text.length - 1) === "}")
		return sub
	else
		return text
}

class Expression {
	constructor() {
		this._elem = undefined
		this._innerElem = undefined
		this._subExpressions = []
	}
	render() {
		var elem = (this._elem = document.createElement("div"))
		Expression._container.appendChild(elem)
		// elem.style = "background: #aaa; width: 300px"
		katex.render(this.tex, elem)
		this._innerElem = elem.children[0]
		this.dispatchSubElements()
	}
	dispatchSubElements() {
		var subElements = this._elem.querySelectorAll(
			"span.mord span.mord:not(span.mord span.mord span.mord)")
		this.subExpressions.forEach((subExpression, i) => subExpression.elem = subElements[i])
	}
	get subExpressions() {
		return this._subExpressions.slice()
	}
	set elem(elem) {
		this._elem = elem
		elem.style = "background-color: rgba(255, 0, 0, 0.2);"
	}
	static _buffer
	static _parent
	static _container
	static set container(container) {
		// TODO: gérer les changements de container quand des expressions existent
		// déja dans un ancien container
		Expression._container = container
	}
	get tex() { return "" }
	get powerSplitTex() {
		return [this.tex, ""]
	}
	// get buffer() {
	// 	return Expression.buffer
	// }
	// set buffer(buffer) {
	// 	Expression.buffer = buffer
	// }
	drag() {
		Expression._buffer = this.clone()
		Expression._buffer.render()
		this._innerElem.classList.add("drag")
	}
	drop(canDrop) {
		var cantDrop = canDrop? false: true
		if (cantDrop) Expression._buffer.remove()
		this._innerElem.classList.remove("drag")
		this._buffer = null
	}
	remove() {
		this._elem.remove()
	}
}

class EmptyExpression extends Expression {

}

class Variable extends Expression {
	constructor(name) {
		super()
		this._name = name
	}
	get name() {return this._name}
	get tex() {return this._name}
	clone() {	return new Variable(this.name) }
}

class Fraction extends Expression {
	// constructor(numerator, denominator) {
	// 	super()
	// 	this._subExpressions.push(numerator, denominator)
	// }
	constructor(...subElements) {
		super()
		this._subExpressions.push(...subElements)
	}
	get numerator() { return this.subExpressions[0] }
	get denominator() { return this.subExpressions[1] }
	get tex() { return `\\frac{${this.numerator.tex}}{${this.denominator.tex}}`	}
	// clone() { 
	// 	return new Fraction(
	// 		this.numerator.clone(), 
	// 		this.denominator.clone()
	// 	)
	// }
	clone() { return new Fraction(...this.subExpressions.map(sub=>sub.clone()))	}

}

class SignedTerm extends Expression {
	constructor (...factors) {
		super()
		this._subExpressions = factors
		this._isNegative = false
	}

	get factors() { return this._subExpressions }
	get isNegative () { return this._isNegative}
	negate() { this._isNegative = !this._isNegative; return this }
	get tex() { return (this.isNegative? "-": "") + this.absoluteTex }
	get absoluteTex() { return this.factors.map(f => `{${f.tex}}`).join(" ")}
	get signedTex() { return (this.isNegative? "-": "+") + this.absoluteTex }
	clone() {
		var factors = this.factors.map(factor => factor.clone())
		var clone = new SignedTerm(...factors)
		if (this.isNegative) clone.negate()
		return clone
	}
	multiply(...args) {
		var {factors} = this
		var first = this.factors[0]
		if (first instanceof UnsignedNumber)
			first.multiply(...args)
		else {
			factors.unshift(UnsignedNumber.new(...args))
		}
	}
}

class Sum extends Expression {
	constructor(...terms) {
		super()
		this._subExpressions= terms
	}
	get terms() { return this._subExpressions}
	get tex() {
		var [first, ...terms] = this.terms
		return [first.tex, ...terms.map(term => term.signedTex)].join("")
	}
	clone() { return new Sum(...this.terms.map(term => term.clone()))	}
	negate() { this.terms.forEach(term => term.negate()) }
	multiply(...args) {	this.terms.forEach(term => term.multiply(...args)) }
}

class UnsignedNumber extends Expression {
	constructor (value) {
		super()
		this._value = value
	}
	static new(a, b) {
		return Number.isInteger(a)?
			Number.isInteger(b)? 
				new UnsignedRational(a, b):
				new UnsignedInteger(a):
			Number.isInteger(a.a)?
				new UnsignedRational(a):
				new UnsignedFloat(a)
	}
	get value() { return this._value }
	get tex() { return `${this.value}` }
	multiply(number) {
		this._value = number * this.value
	}
	clone() { console.error("classe virtuelle: clonage interdit")}
}

class UnsignedInteger extends UnsignedNumber {
	clone() { return new UnsignedInteger(this.value) }
}

class UnsignedFloat extends UnsignedNumber {
	clone() { return new UnsignedFloat(this.value) }
}

class UnsignedRational extends UnsignedNumber {
	constructor(a, b) {
		super()
		this._pair = a.b? a: {a, b}
	}
	get a() { return this.pair.a }
	get b() { return this.pair.b }
	get pair() { return this._pair }
	get value() { return this.a / this.b }
	get tex() { 
		var {a, b} = this.pair; 
		return `\\frac{${a}}{${b}}` 
	}
	clone() { 
		var {a, b} = this.pair
		return new UnsignedRational(a, b)
	 }
	 multiply(a, b) {
		if (a.b) { b = a.b, a = a.a }
		else if (!b) b = 1
		var {a: pa, b: pb} = this.pair 
		this._pair = {a: a*pa, b: b*pb}
	 }
}

class Bracket extends Expression {
	constructor(inside) {
		super()
		this._subExpressions = [inside]
	}
	get inside() { return this._subExpressions[0] }
	get tex() { return `\\left( {${this.inside.tex}} \\right)`}
	// clone() { return new Bracket(this.inside.clone()) }
	clone() { return new Bracket(...this.subExpressions.map(sub => sub.clone())) }
}

class Power extends Expression {
	constructor(base, exponent) {
		super()
		this._subExpressions = [base, exponent]
	}
	get base() { return this._subExpressions[0] }
	get exponent() { return this._subExpressions[1] }
	get tex() {
		var {base, exponent} = this
		var base_tex = base.powerSplitTex
		return `${base_tex[0]}^{${exponent.tex}}${base_tex[1]}`
	}
	// clone() { return new Power(this.base.clone(), this.exponent.clone())}
	clone() { return new Power(...this.subExpressions.map(sub => sub.clone())) }
}

class Root extends Expression {
	constructor(radicand, index) {
		super()
		this._subExpressions = [radicand, index]
	}
	get radicand() { return this._subExpressions[0] }
	get index() { return this._subExpressions[1] }
	get tex() {
		var {radicand, index} = this
		var index_tex = undefined===index? "": `[{${index.tex}}]`
		return `\\sqrt${index_tex}{${radicand.tex}}`
	}
	// clone() { return new Root(this.radicand.clone(), this.index.clone()) }
	clone() { return new Root(...this.subExpressions.map(sub => sub.clone())) }
}

class Function extends Variable {
	constructor(name, ...variables) {
		super(name)
		this._subExpressions = variables
		this._showBrackets = true
	}
	get variables() { return this._subExpressions }
	get tex() {
		var {name, variables, _showBrackets: show} = this
		var var_tex = variables.map(v => v.tex).join(", ")
		return show?
			`${name} \\! \\left({${var_tex}}\\right)`:
			`${name} {${var_tex}}`
	}
	toggleBracket() {
		return this._showBrackets = !this._showBrackets, this
	}
	clone() {	return new Function(this.name, ...this.variables) }
}

class Equality extends Expression {
	constructor(left, right) {
		super()
		this._subExpressions = [left, right]
	}
	get left() { return this._subExpressions[0] }
	get right() { return this._subExpressions[1] }
	get tex() { return `${this.left.tex}=${this.right.tex}` }
	// clone() { return new Equality(this.left, this.right) }
	clone() { return new Equality(...this.subExpressions.map(sub => sub.clone())) }
}

// function grayDiv() {
// 	var div = document.createElement("div")
// 	document.body.appendChild(div)
// 	div.style = "background: #aaa; width: 300px"
// 	return div
// }

Expression._container = document.createElement("div")
Expression._container.classList.add("expression-container")
document.body.append(Expression._container)

var exprs = testExpression()
function testExpression() {
	// return [new Fraction(
	// 	new Variable("a"),
	// 	new Variable("b")
	// ),
	// new Fraction(
	// 	new Fraction(
	// 		new Variable("x"),
	// 		new Variable("y")),
	// 		new Fraction(
	// 			new Variable("a"),
	// 			new Variable("b"))
	// )
	// ].map(e => (e.render(), e))
	var exprs = [
		new Variable("u"),
		new Variable("y")
	]
	exprs.push(new Fraction(exprs[0], exprs[1]))
	// exprs.push(new SignedTerm(new UnsignedInteger(4), exprs[0], exprs[1]))
	// exprs.push(new SignedTerm(new UnsignedFloat(3.14), exprs[0], exprs[1], exprs[2]).negate())
	// exprs.push(new SignedTerm(new UnsignedRational(3, 4), exprs[0], exprs[1], exprs[2]))
	// exprs.push(new Sum(exprs[3], exprs[4], exprs[5]))
	// exprs.push(exprs[6].clone())
	// exprs[7].negate()
	// exprs.push(exprs[7].clone())
	// exprs[8].multiply(100)
	// exprs.push(new SignedTerm(exprs[0].clone()))
	// exprs.push(new SignedTerm(exprs[1].clone()))
	// exprs[9].multiply(10, 3)
	// exprs[10].multiply(10, 23)
	// exprs[10].multiply(10, 23)
	// exprs.push(new Bracket(exprs[8]))
	// exprs.push(new Power( new Variable("u"), new UnsignedInteger(3)))
	// exprs.push(new Root( new Variable("u"), exprs.pop()))
	// exprs.push(new Root( new Variable("u"), exprs.pop()))
	// exprs.push(new Root( new Variable("u"), exprs.pop()))
	// exprs.push(
	// 		new Function("\\sin", 
	// 		new Sum(
	// 			new SignedTerm(new Variable("\\theta")), 
	// 			new SignedTerm(new Variable("\\phi")).negate()
	// 		)
	// 	)
	// )
	// exprs.push(
	// 	new Function("\\csc",
	// 	new Variable("\\psi")
	// ).toggleBracket()
	// )
	// exprs.push(new Function("f", new Variable("u"), new Variable("v")))
	// exprs.push(new Equality(exprs[7].clone(), exprs[2].clone()))
				
	exprs.slice().map(e => e.render())
	return exprs
}