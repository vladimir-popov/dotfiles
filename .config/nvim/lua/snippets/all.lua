local function pair(pair_begin, pair_end, cond)
    return s({ trig = pair_begin .. pair_end, wordTrig = false }, {
        t({ pair_begin }),
        i(1),
        t({ pair_end }),
    }, cond and {
        condition = cond(pair_begin, pair_end),
    })
end

local snippets

local autosnippets = {
    -- these should be inside your snippet-table.
    pair('(', ')'),
    pair('{', '}'),
    pair('[', ']'),
    pair('<', '>'),
    pair("'", "'"),
    pair('"', '"'),
    pair('`', '`'),
}

return snippets, autosnippets
