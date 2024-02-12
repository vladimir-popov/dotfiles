local include_std =
    s({ trig = '^incc', regTrig = true }, fmt([[#include <{}>]], { i(0, 'lib_name') }))

local include_custom =
    s({ trig = '^incs', regTrig = true }, fmta([[#include "<>"]], { i(0, 'lib_name') }))

local one_line_comment = s('/* ', fmta([[/* <> */]], { i(0) }))
local multyline_comment = s(
    '/**',
    fmta(
        [[/**
* <>
*/]],
        { i(0) }
    )
)

local for_loop = s(
    'forc',
    fmt(
        [[for (int {} = {}; {} < {}; {}++)
  {{
    {}
  }}
]],
        { i(1, 'i'), i(2, '0'), i(3, 'i'), i(4), i(5, 'i'), i(0) }
    )
)

local for_loop_x = s(
    { trig = 'for(%a)', regTrig = true },
    fmt([[for (int {var} = 0; {var} < {}; {var}++)]], {
        var = f(function(_, snip)
            return snip.captures[1]
        end),
        i(0),
    }, {
        repeat_duplicates = true,
    })
)

local func = s(
    { trig = '^([%w_]+)fun', regTrig = true },
    fmta(
        [[<>
<> (<>)
{
  <>
}]],
        {
            f(function(_, snip)
                return snip.captures[1]
            end),
            i(1, 'function_name'),
            i(2),
            i(0),
        }
    )
)

local snippets = {
    func,
    for_loop,
}

local autosnippets = {
    one_line_comment,
    multyline_comment,
    for_loop_x,
    include_std,
    include_custom,
}

return snippets, autosnippets
