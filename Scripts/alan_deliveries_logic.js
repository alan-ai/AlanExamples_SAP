projectAPI.updateProductEntities = (p, params, cb) => {
    project.prods = JSON.parse(params.json);
    cb();
};

const screenAliases = {
    "suppliers": "Supplier",
    "product categories": "ProductCategory",
    "product texts": "ProductText",
    "purchase order items": "PurchaseOrderItems",
    "purchase order headers": "PurchaseOrderHeaders",
    "stock": "Stock",
    "sales order items": "Sales",
    "customers": "Customer",
    "sales order headers": "SalesOrder",
    "products": "Product"
};

//TODO use only alias overrides
const categoryAliases = {
    "projectors": "Projectors",
    "portable players": "Portable Players",
    "players": "Portable Players",
    "software": "Software",
    "notebooks": "Notebooks",
    "laptops": "Notebooks",
    "smartphones": "PDAs & Organizers",
    "phones": "PDAs & Organizers",
    "pdas and organizers": "PDAs & Organizers",
    "flat screen monitors": "Flat Screen Monitors",
    "monitors": "Flat Screen Monitors",
    "displays": "Flat Screen Monitors",
};

const comparators = {
    ">": (a, b) => a > b,
    "<": (a, b) => a < b
}

const compAliases = {
    expensive: comparators[">"],
    cheaper: comparators["<"],
    more: comparators[">"],
    less: comparators["<"],
    under: comparators["<"],
    above: comparators[">"],
    below: comparators["<"],
}

const products = _.reduce(project.prods, (a, p) => {
    a[p.ProductId] = p;
    return a
}, {});

const supByName = _.reduce(project.sups, (a, p) => {
    a[p.SupplierName.toLowerCase()] = p;
    return a
}, {});

const supById = _.reduce(project.sups, (a, p) => {
    a[p.SupplierId] = p;
    return a
}, {});

// categories in products do not correspond category list
// project.cats.map(p => p.CategoryName)
const categories = _.uniq(project.prods.map(p => p.CategoryName));

const supcat = _.reduce(project.sups, (a, s) => {
    a[s.SupplierName] = _.uniq(project.prods.filter(p => p.SupplierId === s.SupplierId).map(p => p.CategoryName));
    return a
}, {});

const catprod = _.reduce(categories, (a, c) => {
    a[c.toLowerCase()] = project.prods.filter(p => p.CategoryName === c).map(p => p.ProductId);
    return a;
}, {});

const catsup = _.reduce(categories, (a, c) => {
    a[c.toLowerCase()] = _.uniq(project.prods.filter(p => p.CategoryName === c).map(p => supById[p.SupplierId].SupplierName));
    return a
}, {});

const vMain = visual(state => state.screen == "Main");

// navigate to screen command
intent(vMain, `(go to|open|show) $(SCREEN ${Object.keys(screenAliases).join(`|`)}) (screen|)`, p => {
    p.play({command: 'navigate', screen: screenAliases[p.SCREEN.toLowerCase()]});
    p.play(`(Opening ${p.SCREEN}|)`);
});

intent(`(go|) back`, p => {
    p.play({command: "goBack"});
    p.play(`(going back|)`);
})

intent("(What|Which) (are the|) products (are|) (available|there|do you have)", p => {
    if (!_.isEmpty(project.prods)) {
        p.play({command: 'navigate', screen: 'Product'});
        p.play(`There are (several|${_.size(project.prods)}) different products, including:`);
        playList(p, project.prods, "highlightProductId", a => a.Name, a => a.ProductId, true);
    } else {
        p.play(`No products for ${p.SUP}`);
    }
});

function findProductByName(name) {
    return _.first(project.prods
        .filter(pr => pr.Name && pr.Name.toLowerCase() === name.toLowerCase()));
}

intent(`How much (is|does) the $(P ${project.prods.map(s => s.Name).join(`|`)}) (cost|)`,
    `What is the (cost|price) of the $(P ${project.prods.map(s => s.Name).join(`|`)})`, p => {
        let product = findProductByName(p.P);
        if(!product) {
            p.play(`${p.P} not found in our product list`);
        } else {
            p.play(`The ${p.P} is ${product.Price} ${product.CurrencyCode}`);
        }
    });

intent(`Who (supplies|provides|has) the $(P ${project.prods.map(s => s.Name).join(`|`)})`,
    `Who is the $(P ${project.prods.map(s => s.Name).join(`|`)}) (supplier|provider)`, p => {
        let product = findProductByName(p.P);
        if (!product) {
            p.play(`${p.P} not found in our product list`);
        } else {
            let sup = supById[product.SupplierId].SupplierName;
            if (!sup) {
                p.play(`We could not find supplier for ${p.P}`);
            } else {
                p.play(`The ${p.P} is supplied by ${supById[product.SupplierId].SupplierName}`,
                    `${supById[product.SupplierId].SupplierName} supplies the ${p.P}`);
            }
        }
    });

intent("(What|Which) (are the|) (product|) categories (are|) (available|there|do you have)", p => {
    p.play(`There are ${_.size(categories)} categories, (including|)`);
    playList(p, categories, "highlightCategoryName", a => a, a => a, true);
});

const vProducts = visual(state => state.screen == 'Product');

function findProductsByIntentParams(categoryP, comparatorP, field, valueP) {
    const category = categoryAliases[categoryP.toLowerCase()];
    const comparator = compAliases[comparatorP.toLowerCase()];
    const value = valueP.number ? valueP.number : valueP;
    return project.prods
        .filter(pr => pr.Category === category && comparator(parseInt(pr[field]), value));
}

//condition
function conditionIntent(p, foundAnswer, notFoundAnwer) {
    const products = findProductsByIntentParams(p.CAT, p.COMP, "Price", p.NUMBER);
    const productIds = products.map(pr => pr.ProductId);
    p.play({command: 'showProductIds',
        value: productIds});
    const conditionStr = `${p.CAT} ${p.COMPs.join(' ')} than ${p.NUMBER} ${p.CUR || ""}`;
    p.play(products.length ?
        foundAnswer(products.length, conditionStr) :
        notFoundAnwer(conditionStr));
    playList(p, products, "highlightProductId", pr => pr.Name, pr => pr.ProductId);
}

intent(vProducts, `(show|find|what|how many|do we have|do you have)  $(CAT ${Object.keys(categoryAliases).join(`|`)}) $(COMP ${Object.keys(compAliases).join(`|`)}) than $(NUMBER) $(CUR dollar_|euro_|)`, p => {
    conditionIntent(p,
        (len, condStr) => `(Yes,|)(We have|There are|Found) ${len} ${condStr}`,
        condStr => `(No. We don't have|There are no|Can't find) ${condStr}`);
});

intent(vProducts, `(show|find|what|how many|do we have|do you have) $(CAT ${Object.keys(categoryAliases).join(`|`)}) $(COMP ${Object.keys(compAliases).join(`|`)}) than $(NUMBER) $(CUR dollar_|euro_|)`, p => {
    conditionIntent(p,
        (len, condStr) => `(Yes,|)(We have|There are|Found) ${len} ${condStr}`,
        condStr => `(No. We don't have|There are no|Can't find) ${condStr}`);
});

intent(vProducts, `(show|find|what|how many|do we have|do you have) $(CAT ${Object.keys(categoryAliases).join(`|`)}) $(COMP ${Object.keys(compAliases).join(`|`)}) than $(NUMBER) $(CUR dollar_|euro_|) (do you have|)`, p => {
    conditionIntent(p,
        (len, condStr) => `(Yes,|)(We have|There are|Found) ${len} ${condStr}`,
        condStr => `(No. We don't have|There are no|Can't find) ${condStr}`);
});

//category
function categoryIntent(p, foundAnswer, notFoundAnswer) {
    const category = categoryAliases[p.CAT.toLowerCase()];
    const products = project.prods.filter(pr => pr.Category == category);
    p.play({
        command: 'showProductCategory',
        value: categoryAliases[p.CAT.toLowerCase()]
    });
    p.play(products.length ?
        foundAnswer(products.length, p.CAT) :
        notFoundAnswer(p.CAT));
    playList(p, products, "highlightProductId", pr => pr.Name, pr => pr.ProductId, true);
}

intent(vProducts, `(show|find) $(CAT ${Object.keys(categoryAliases).join(`|`)})`, p => {
    categoryIntent(p, (len, cat) => `Found ${len} ${cat}`, cat => `Can't find ${cat}`);
});

intent(vProducts, `do you have $(CAT ${Object.keys(categoryAliases).join(`|`)})`, p => {
    categoryIntent(p, (len, cat) => `Yes. There are ${len} ${cat}`, cat => `No. There are no ${cat}`);
});

intent(vProducts, `how many $(CAT ${Object.keys(categoryAliases).join(`|`)}) (do you have|)`, p => {
    categoryIntent(p, (len, cat) => `We have ${len} ${cat}`, cat => `We don't have ${cat}`);
});

intent(vProducts, `show all`, `reset filters`, p => {
    p.play({
        command: 'showProductCategory',
        value: 'All'
    });
    p.play('');
});

intent("What can you do", "What can I do", "What's this (SAP|) (app|application)", p => {
    p.play("(This is the SAP Delivery Demo App. With a visual voice experience powered by Alan AI|). " +
        "You can use commands like 'What products do you have?', 'Who are the suppliers?', and 'How much was the last purchase?'");

});

intent("What is Alan (AI|)?", p => {
    p.play("Alan AI is a Voice AI platform that lets you add a (complete|) visual voice experience to any application. " +
        "(The voice in this application is powered by Alan AI|)");
});

intent("What (screen|) is this?", "Where am I", "What commands can I use here", p => {
    if (!p.visual.screen) {
        p.play("I can not say what screen you are on");
        return;
    }
    switch (p.visual.screen) {
        case "Main":
            p.play("This is the Collections screen. Here, you can use commands like 'What products do you have?', " +
                "'Who are the suppliers?' and 'How much was the last purchase?",
                "This is the Collections screen. Here, you can ask about Suppliers, Products, Purchase Orders, and Product Categories");
            break;
        case "Supplier":
            p.play("This is the Suppliers screen. Here, you can (use commands|ask questions) like 'Who are the suppliers?' " +
                "and 'What products does Becker Berlin offer?'");
            break;

        case "SupplierDetails":
            p.play("This is the supplier details screen. (Here,|) you can (use commands|ask questions) like " +
                "'Where are they located?', 'What was the last order?', and 'What products do they offer?'");
            break;

        case "ProductCategory":
            p.play("This is the Product Category screen. (Here,|) you can (use the command|ask the question) 'What are the categories?'");
            break;

        case "PurchaseOrderHeaders":
            p.play("This is the Purchase Order Header screen. (Here,|) you can (use commands|ask questions) like " +
                "Show the second purchase order, How much was the last purchase order?, What was the highest order?, and What was the lowest order?");
            break;

        case "Product":
            p.play("This is the Products screen. (Here,|) you can (use commands|ask questions) like What products are available?" +
                "How much is the (Comfort Easy|Flat Basic|Flat XL|Flat Future)?, and What (Flat screen monitors|projectors|Notebooks|Portable players|) are available?");
            break;

        case "ProductDetails":
            p.play("This is the [product_name] product screen. (Here,|) you can (use commands|ask questions) like How much is it? " +
                "Who's the supplier?, and What kind of product is this?");
            break;
    }
});

function playList(p, a, command, name, id, readMore = false) {
    let nPlay = a.length <= 4 ? a.length : 3;
    for (let i = 0; i < nPlay; i++) {
        p.play({
            command: command,
            value: id(a[i])
        });
        p.play(name(a[i]));
    }
    p.play({command: command, value: null});
    let others = a.length - nPlay;
    if (others > 0) {
        p.play(`and ${others} others`);
        if (readMore) {
            p.play('Do you want to hear more?');
            let state = {items: a, from: 3, step: 3, name: name, command: command, id: id};
            p.then(repeatListItems, {state});
        }
    }
}

const repeatListItems = context(() => {
    title("repeat items");

    follow("(yes|sure|ok|next|show more)", p => {
        let {state} = p;
        if (!state.items) {
            p.play("There are no items");
            p.print("There are no items");
            return;
        }
        if (state.from + state.step > state.items.length) {
            state.step = state.from + state.step - state.items.length + 1;
        }
        let to = Math.min(state.from + state.step, state.items.length);
        let showItems = state.items.slice(state.from, to);
        if (_.isEmpty(showItems)) {
            p.play(`There are no more items`);
            p.resolve(null);
            return;
        } else {
            showItems.forEach(item => {
                p.play({
                    command: state.command,
                    value: state.id(item)
                });
                p.play(state.name(item));

            });
            p.play({command: state.command, value: null});
            if (to < state.items.length) {
                p.play(`Do you want to hear more?`);
            }
        }
        p.state.from = to;
    });

    follow("(repeat|repeat please|say again)", p => {
        let {state} = p;
        if (!state.items) {
            p.play("There are no items");
            p.print("There are no items");
            return;
        }
        let showItems = state.items.slice(state.from - state.step, state.from);
        showItems.forEach(item => {
            p.play(state.name(item));
            p.play({
                command: state.command,
                value: state.id(item)
            });
        });
        p.play({command: state.command, value: null});
        if (state.from < state.items.length) {
            p.play(`Do you want to hear more?`);
        }
    });

    follow("(no|next time|not now|later|nope|stop)", p => {
        if (!p.state.items) {
            p.play("No items");
            return;
        }
        p.play("OK");
        p.resolve(null);
    });
});