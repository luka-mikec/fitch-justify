var renderer = 'fitch';



var status_div = document.querySelector("#status"),
    in_div = document.querySelector("#in"),
    out_div = document.querySelector("#out"),
    out_nums_div = document.querySelector("#out_nums"),
    out_nodes_div = document.querySelector("#out_nodes"),
    out_just_div = document.querySelector("#out_just"),
    out_fitch = document.querySelector("#out_fitch"),
    out_gentz = document.querySelector("#out_gentz"),
    out_lat_div = document.querySelector("#out_lat"),
    out_dbg_div = document.querySelector("#out_dbg");


class just {
    constructor(op, ie, a, b, c, d, e) {
        Object.assign(this, {op, ie, a, b, c, d, e});

        let x = op + (ie ? ie: '');
        let x_html = html[op] + (ie ? clang[ie] : '');
        let x_latex = '$' + latex[op] + '$' + (ie ? clang[ie] : '');

        this.op_ie = x;
        this.op_ie_html = x_html;
        this.op_ie_latex = x_latex;

        if (x == lasm) {
            this.text = x_html;
            this.latex = x_latex;
        }
        if ([land + lelim,   lor + lintro,   lnot + lelim,   lfals + lelim,   lreit,   lall + lelim,   lexists + lintro,  lall + lintro].includes(x)) {
            this.text = x_html + ", " + a;
            this.latex = x_latex + ", " + a;
        }
        if ([land + lintro,  lcond + lelim,  liff + lelim,   lfals + lintro  ].includes(x))
        {
            this.text = x_html + ", " + a + ", " + b;
            this.latex = x_latex + ", " + a + ", " + b;
        }
        if ([lcond + lintro,  lnot + lintro].includes(x))
        {
            this.text = x_html + ", " + a + "&mdash;" + b;
            this.latex = x_latex + ", " + a + "--" + b;
        }
        if (x == lor + lelim)
        {
            this.text = x_html + ", " + a + ", " + b + "&mdash;" + c + ", " + d + "&mdash;" + e;
            this.latex = x_latex + ", " + a + ", " + b + "--" + c + ", " + d + "--" + e;
        }
        if (x == liff + lintro)
        {
            this.text = x_html + ", " + a + "&mdash;" + b + ", " + c + "&mdash;" + d;
            this.latex = x_latex + ", " + a + "--" + b + ", " + c + "--" + d;
        }
        if (x == lexists + lelim)
        {
            this.text = x_html + ", " + a + ", " + b + "&mdash;" + c;
            this.latex = x_latex + ", " + a + ", " + b + "--" + c;
        }
    }
}

function* lines_before(start) {
    function *traverser(branch, start)
    {
        for (let a of branch.bs)
        {
            if (a === start)
                break;

            if (a.form)
                yield a;
        }
        if (branch.prev)
            yield * traverser(branch.prev, start);
    }

    yield * traverser(start.node, start);
}



class line {
    constructor(str, state) {
        try {
            if (str.trim() == '~')
            {
                state.starting_asms = false;
                return;
            }


            const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
            parser.feed(str.trim());
            Object.assign(this, parser.results[0]);

            if (this.indent != 1)
            {
                state.starting_asms = false; // this is not an initial assumption
            }

            if (state.starting_asms) {
                this.is_start_asm = true;
                state.curr.bs.push(this);
                state.curr.indent = 1;
                if (this.isnew)
                    state.starting_asms = false;
            }
            else
            {
                if (this.isnew)
                {
                    let old_indent = state.curr.indent;
                    if (this.indent == old_indent)
                    {
                        // subproof following a same-level subproof
                        state.curr = state.curr.prev;
                        state.curr.bs.push( { prev: state.curr, bs: [], indent: this.indent } );
                        state.curr = state.curr.bs[state.curr.bs.length - 1];
                        state.curr.bs.push(this);
                    }
                    else
                    {
                        // a new subproof
                        state.curr.bs.push( { prev: state.curr, bs: [], indent: this.indent } );
                        state.curr = state.curr.bs[state.curr.bs.length - 1];
                        state.curr.bs.push(this);
                    }
                }
                else if (this.indent == state.curr.indent)
                {
                    // a standard new line within the current branch
                    state.curr.bs.push(this);
                }
                else
                {
                    // line following the finished subproof
                    state.curr = state.curr.prev;
                    state.curr.bs.push(this);
                }
            }

            this.node = state.curr;
            this.lineno = state.next_lineno;
            //this.lines_before = [...lines_before(this)];

            ++state.next_lineno;
            this.justify();
        } catch (e) {
            console.log('error parsing: ' + str)
            throw e;
        }
    }


    justify() {
        if (this.isnew || this.is_start_asm) {
            this.just = [new just(lasm)];
            return;
        }
        else
        {
            let fval = form => JSON.stringify(form);


            this.just = [];
            let mf = this.form;
            let mval = fval(mf);
            let reg = (op, ie, a, b, c, d, e) => this.just.push(new just(op, ie, a, b, c, d, e));

            let needed_or_intro, needed_exists_elim;

            let my_i = this.node.bs.indexOf(this);
            if (my_i > 0 && this.node.bs[my_i - 1].bs)
            {
                let subproof = this.node.bs[my_i - 1].bs;
                // lcond + lintro,  lnot + lintro
                if (mf.op === lcond && fval(subproof[0].form) === fval(mf.e1) && fval(subproof[subproof.length - 1].form) === fval(mf.e2))
                    reg(lcond, lintro, subproof[0].lineno, subproof[subproof.length - 1].lineno);
                if (mf.op === lnot && fval(subproof[0].form) === fval(mf.e) && subproof[subproof.length - 1].form.op === lfals)
                    reg(lnot, lintro, subproof[0].lineno, subproof[subproof.length - 1].lineno);

                // lexists + lelim
                if (mval === fval(subproof[subproof.length - 1].form))
                    needed_exists_elim = { f: subproof[0].form,  b: subproof[0].lineno,  c: subproof[subproof.length - 1].lineno }


                if (my_i > 1 && this.node.bs[my_i - 2].bs)
                {
                    let subproof2 = subproof;
                    subproof = this.node.bs[my_i - 2].bs;

                    // liff + lintro, lor + lelim [part 1]
                    if (mf.op === liff && fval(subproof[0].form) === fval(mf.e1) && fval(subproof[subproof.length - 1].form) === fval(mf.e2) &&
                        fval(subproof2[0].form) === fval(mf.e2) && fval(subproof2[subproof2.length - 1].form) === fval(mf.e1))
                        reg(liff, lintro, subproof[0].lineno, subproof[subproof.length - 1].lineno,
                            subproof2[0].lineno, subproof2[subproof2.length - 1].lineno);

                    if (fval(subproof[subproof.length - 1].form) === fval(subproof2[subproof2.length - 1].form) &&
                        fval(subproof[subproof.length - 1].form) === mval)
                        needed_or_intro = {
                            left: fval(subproof[0].form),
                            right: fval(subproof2[0].form),
                            b: subproof[0].lineno,
                            c: subproof[subproof.length - 1].lineno,
                            d: subproof2[0].lineno,
                            e: subproof2[subproof2.length - 1].lineno,
                        }
                }

            }

            for (let a of lines_before(this))
            {

                let f = a.form;
                let val = fval(f);

                // land + lelim,   lor + lintro,   lnot + lelim,   lfals + lelim,   're'
                if (mval === val)
                    reg(lreit, undefined, a.lineno);
                if (f.op === land && fval(f.e1) === mval)
                    reg(land, lelim, a.lineno);
                else if (f.op === land && fval(f.e2) === mval)
                    reg(land, lelim, a.lineno);
                if (mf.op === lor && val === fval(mf.e1))
                    reg(lor, lintro, a.lineno);
                else if (mf.op === lor && val === fval(mf.e2))
                    reg(lor, lintro, a.lineno);
                if (f.op === lnot && f.e.op === lnot && fval(f.e.e) === mval)
                    reg(lnot, lelim, a.lineno);
                if (f.op === lfals)
                    reg(lfals, lelim, a.lineno);

                // lall + lelim
                if (f.op === lall && subst_inst_of(mf, f.e, { v: f.v,  c: null,  total: true, ignore_transl: false  }, true ))
                    reg(lall, lelim, a.lineno);

                // lexists + lintro
                if (mf.op === lexists && subst_inst_of(f, mf.e, { v: mf.v,  c: null,  total: false, ignore_transl: false  } ) )
                    reg(lexists, lintro, a.lineno);

                let needed_all_intro;

                // lall + lintro [part 1]
                let all_intro_transl = { v: mf.v,  c: null,  total: true, ignore_transl: false  };
                if (mf.op === lall && subst_inst_of(f, mf.e, all_intro_transl, true ))
                    needed_all_intro = { a: a.lineno, constant:  all_intro_transl.c };


                // lexists + lelim [part 2]
                let exists_elim_transl = { v: f.v,  c: null,  total: true, ignore_transl: false  };
                let exists_search = false;
                if (needed_exists_elim && f.op === lexists  && subst_inst_of(needed_exists_elim.f, f.e, exists_elim_transl, true) && !has_constant(mf, exists_elim_transl.c))
                {
                    // c is automatically saved in the translation
                    exists_search = true;
                }

                for (let b of lines_before(this))
                {
                    let f2 = b.form;
                    let val2 = fval(f2);

                    // land + lintro,  lcond + lelim,  liff + lelim,   lfals + lintro
                    if (a.lineno <= b.lineno && mf.op == land && fval(mf.e1) === val && fval(mf.e2) === val2)
                        reg(land, lintro, a.lineno, b.lineno);
                    else if (a.lineno <= b.lineno && mf.op == land && fval(mf.e2) === val && fval(mf.e1) === val2)
                        reg(land, lintro, a.lineno, b.lineno);
                    if (f.op == lcond && fval(f.e1) === val2 && fval(f.e2) === mval)
                        reg(lcond, lelim, a.lineno, b.lineno);
                    if (f.op == liff && fval(f.e1) === val2 && fval(f.e2) === mval)
                        reg(liff, lelim, a.lineno, b.lineno);
                    if (f.op == liff && fval(f.e2) === val2 && fval(f.e1) === mval)
                        reg(liff, lelim, a.lineno, b.lineno);
                    if (f2.op === lnot && fval(f2.e) === val && mf.op === lfals)
                        reg(lfals, lintro, a.lineno, b.lineno)

                    if (needed_all_intro && (b.isnew || b.is_start_asm) && has_constant(f2, needed_all_intro.constant) )
                        needed_all_intro.broken = true;
                    if (exists_search && has_constant(f2, exists_elim_transl.c))
                        exists_search = false;
                }

                // lor + lelim [part 2]
                if (needed_or_intro && fval(f.e1) === needed_or_intro.left && fval(f.e2) === needed_or_intro.right)
                    reg(lor, lelim, a.lineno, needed_or_intro.b, needed_or_intro.c, needed_or_intro.d, needed_or_intro.e);

                // lall + lintro [part 2]
                if (needed_all_intro && !needed_all_intro.broken)
                    reg(lall, lintro, needed_all_intro.a);

                // lexists + lelim [part 3]
                if (exists_search)
                    reg(lexists, lelim, a.lineno, needed_exists_elim.b, needed_exists_elim.c)
            }




            if (this.just.length === 0) {
                this.just = [{text: '(?)', latex: '(?)', op_ie_html: '(?)'}];
                this.unjust = true;
            }
            return;
        }


    }
}

function get_line(root, line)
{
    if (root.bs)
    {
        for (let obj of root.bs)
        {
            let r = get_line(obj, line);
            if (r)
                return r;
        }
    }
    else
        if (root.lineno === line)
            return root;

    return undefined;
}


function render(branch, out) {
    // basic text renderer
    let str_formula = html_str_formula;

    let init = !out;
    if (init)
    {
        out = {};
        out.val = ``;
    }

    for (let b of branch.bs) {
        if (b.form)
            out.val += '|'.repeat(b.indent - (b.isnew ? 1 : 0)) +
                (b.isnew ? 'L' : '') + ' ' + str_formula(b.form) + '\t\t ' + b.just.map(j => j.text).join(' ~ ') + ' \n';
        else
            render(b, out);
    }
    if (init)
    {
        out.val += ``;
        return out.val;
    }
}


function render_fitch_lat(branch, out) {
    let str_formula = latex_str_formula;


    let init = !out;
    if (init)
    {
        out = {};
        out.val = ` % this is LaTeX output for use with fitch.sty (http://www.logicmatters.net/resources/fitch.sty)
\\begin{equation*}
\\begin{fitch}
`;
    }

    for (let b of branch.bs) {
        if (b.form)
            out.val += '\\fa'.repeat(b.indent - (b.isnew ? 1 : 0)) +
                (b.isnew ? (b.is_start_asm || b.lineno == 1) ?  '\\fj' : '\\fh' : '') + ' ' + str_formula(b.form) + '\t\t & ' + b.just.map(j => j.latex).join(' (ALT) ') + '\\\\ \n';
        else
            render_fitch_lat(b, out);
    }
    if (init)
    {
        out.val += `
\\end{fitch}
\\end{equation*}
`;
        return out.val;
    }
}

// helper for both html gentzen, and latex gentzen
function gen_gentzen_tree(state, str_formula, str_just, line)
{
    if (line == undefined)
        line = state.next_lineno - 1;

    let me = {type: 'gentz_node'};

    if (line < 0)
        return me;

    let x = '';
    let l;

    do {
        l = get_line(state.root, line);

        me.as_co = {type: 'gentz_as_co'};

        x = l.just[0].op_ie;

        if (x == lreit)
        {
            line = l.just[0].a;
        }

    } while (x == lreit);



    if (x == lasm) {
        me.as_co.st_as = {type: 'gentz_init_as', text: str_formula(l.form)};
        return me;
    }

    me.just = {type: 'gentz_just', text: str_just(l.just[0])};
    me.as_co.as = {type: 'gentz_as', elems: [] };
    me.as_co.co = {type: 'gentz_co', text: str_formula(l.form) };

    if ([land + lelim,   lor + lintro,   lnot + lelim,   lfals + lelim,   lreit,   lall + lelim,   lexists + lintro,  lall + lintro].includes(x)) {
        me.as_co.as.elems.push(gen_gentzen_tree(state, str_formula, str_just, l.just[0].a));
    }
    if ([land + lintro,  lcond + lelim,  liff + lelim,   lfals + lintro  ].includes(x))
    {
        me.as_co.as.elems.push(gen_gentzen_tree(state, str_formula, str_just, l.just[0].a));
        me.as_co.as.elems.push(gen_gentzen_tree(state, str_formula, str_just, l.just[0].b));
    }
    if ([lcond + lintro,  lnot + lintro].includes(x))
    {
        me.as_co.as.elems.push(gen_gentzen_tree(state, str_formula, str_just, l.just[0].b));
    }
    if (x == lor + lelim)
    {
        me.as_co.as.elems.push(gen_gentzen_tree(state, str_formula, str_just, l.just[0].a));
        me.as_co.as.elems.push(gen_gentzen_tree(state, str_formula, str_just, l.just[0].c));
        me.as_co.as.elems.push(gen_gentzen_tree(state, str_formula, str_just, l.just[0].e));
    }
    if (x == liff + lintro)
    {
        me.as_co.as.elems.push(gen_gentzen_tree(state, str_formula, str_just, l.just[0].b));
        me.as_co.as.elems.push(gen_gentzen_tree(state, str_formula, str_just, l.just[0].d));
    }
    if (x == lexists + lelim)
    {
        me.as_co.as.elems.push(gen_gentzen_tree(state, str_formula, str_just, l.just[0].a));
        me.as_co.as.elems.push(gen_gentzen_tree(state, str_formula, str_just, l.just[0].c));
    }

    return me;
}

function render_gentzen_lat(state, tree, out) {
    let str_formula = latex_str_formula;

    let init = !out;
    if (init)
    {
        out = {};
        out.val = ` % this is LaTeX output for use with bussproofs.sty (https://www.math.ucsd.edu/~sbuss/ResearchWeb/bussproofs/bussproofs.sty)
\\begin{prooftree}
`;
    }

    if (tree == undefined)
        tree = gen_gentzen_tree(state, str_formula, x => x.op_ie_latex );

    if (tree.as_co.st_as)
    {
        out.val += `\\AxiomC{\$ ${ tree.as_co.st_as.text } \$}\n`;
        return;
    }

    for (let asmp of tree.as_co.as.elems)
        render_gentzen_lat(state, asmp, out);

    out.val += `\\RightLabel{${ tree.just.text }}\n`;

    switch (tree.as_co.as.elems.length) {
        case 1:
            out.val += `\\UnaryInfC{\$ ${ tree.as_co.co.text } \$}\n`;
            break;
        case 2:
            out.val += `\\BinaryInfC{\$ ${ tree.as_co.co.text } \$}\n`;
            break;
        case 3:
            out.val += `\\TrinaryInfC{\$ ${ tree.as_co.co.text } \$}\n`;
            break;
    }

    if (init)
    {
        out.val += `\\end{prooftree}`;
        return out.val;
    }
}






function render_html(branch) {
    let str_formula = html_str_formula;

    let me = document.createElement('div');
    me.className = 'fitch_branch';

    let me_just = document.createElement('div');

    let me_nums = document.createElement('div');

    for (let b of branch.bs) {
        if (b.form)
        {
            let a = document.createElement('div');
            a.classList.add('fitch_formula');
            let a_just = document.createElement('div');
            a_just.classList.add('fitch_just');
            let a_nums = document.createElement('div');
            a_nums.classList.add('fitch_num');

            if (b.isnew)
            {
                a.classList.add('fitch_assumption');
                a_just.classList.add('fitch_assumption');
                a_nums.classList.add('fitch_assumption');
            }

            a_nums.innerText = b.lineno;
            a.innerText =  str_formula(b.form);
            a_just.innerHTML = b.just.map(j => j.text).join(' ~ ');

            me_nums.appendChild(a_nums);
            me.appendChild(a);
            me_just.appendChild(a_just);
        }
        else
        {
            [you_nums, you, you_just] =render_html(b);
            me.appendChild(you);
            me_just.appendChild(you_just);
            me_nums.appendChild(you_nums);
        }
    }
    return [me_nums, me, me_just];
}




function render_html_gentz(state, tree) {
    let str_formula = html_str_formula;


    if (tree == undefined)
        tree = gen_gentzen_tree(state, str_formula, x => x.op_ie_html);

    let me = document.createElement('div');
    me.className = 'gentz_node';

    if (!tree.as_co)
        return me;

    let me_as_co = document.createElement('div');
    me_as_co.className = 'gentz_as_co';
    me.appendChild(me_as_co);

    if (tree.as_co.st_as) {
        let me_st_as =  document.createElement('div');
        me_st_as.className = 'gentz_init_as';
        me_st_as.innerText = tree.as_co.st_as.text;
        me_as_co.appendChild(me_st_as);

        return me;
    }

    let me_just = document.createElement('div');
    me_just.className = 'gentz_just';
    me_just.innerText = tree.just.text;
    me.appendChild(me_just);

    let me_as = document.createElement('div');
    me_as.className = 'gentz_as';
    me_as_co.appendChild(me_as);

    let me_co = document.createElement('div');
    me_co.className = 'gentz_co';
    me_co.innerText = tree.as_co.co.text;
    me_as_co.appendChild(me_co);

    if (tree.as_co.as.elems.length > 0) {
        me_as.appendChild(render_html_gentz(state, tree.as_co.as.elems[0]));
    }
    if (tree.as_co.as.elems.length > 1) {
        let space = document.createElement('div');
        space.className = 'gentz_as_space';
        me_as.appendChild(space);
        me_as.appendChild(render_html_gentz(state, tree.as_co.as.elems[1]));
    }
    if (tree.as_co.as.elems.length > 2) {
        let space = document.createElement('div');
        space.className = 'gentz_as_space';
        me_as.appendChild(space);
        me_as.appendChild(render_html_gentz(state, tree.as_co.as.elems[2]));
    }

    return me;
}





function compile() {
    let have_unjust = false;
    try {

        let lines = in_div.value.trim().split('\n');
        let state = { root: { bs: [], indent: 1, prev: null }, starting_asms: true, next_lineno: 1 };
        window.dummy_state = JSON.parse(JSON.stringify(state));
        state.curr = state.root;
        window.dummy_state.curr = window.dummy_state.root;

        for (let lin of lines) {
            lin = lin.trim();
            let comp = new line(lin, state);
            if (comp.unjust)
                have_unjust = true;
        }
        window.state = state;

        function replacer(key,value)
        {
            if (key=="prev") return value ? ' (some) ' : ' (none) ';
            if (key=="node") return value ? ' (some) ' : ' (none) ';
            else return value;
        }

        out_dbg.innerText = JSON.stringify(state, replacer, "    ");
        //out_div.innerText = render(state.root);
        [h_n, h, h_j] = render_html(state.root);

        if (out_nums_div.firstChild)
            out_nums_div.firstChild.remove()
        out_nums_div.appendChild(h_n);

        if (out_nodes_div.firstChild)
            out_nodes_div.firstChild.remove()
        out_nodes_div.appendChild(h);

        if (out_just_div.firstChild)
            out_just_div.firstChild.remove()
        out_just_div.appendChild(h_j);


        while (out_gentz.firstChild)
            out_gentz.firstChild.remove()
        out_gentz.appendChild(render_html_gentz(state));

        out_lat_div.innerHTML = window.renderer == 'fitch' ? render_fitch_lat(state.root)
            : render_gentzen_lat(state);
    } catch (e) {
        throw e;
    }
    return !have_unjust;
}

