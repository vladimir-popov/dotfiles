local include_std = s(
    { trig = '^%#inc', regTrig = true },
    fmt([[#include <{}>]], { i(1, 'lib_name') })
)

local include_custom = s(
    { trig = '^%#ins', regTrig = true },
    fmta([[#include "<>"]], { i(1, 'lib_name') })
)

local comment = s('/*', fmta([[/* <> */]], { i(1, 'comment') }))

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
            i(2, 'args'),
            i(0)
        }
    )
)

local snippets = {}
local autosnippets = {
    include_std,
    include_custom,
    comment,
    func,
}

return snippets, autosnippets
