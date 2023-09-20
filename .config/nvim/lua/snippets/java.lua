local main_class = s(
    'mainclass',
    fmta(
        [[public class <> {

    public static void main(String[] args) {
        <>
    }
}
]],
        {
            f(function()
                local name = string.gsub(vim.fn.expand('%:t'), '(%w+).java', '%1')
                return name
            end),
            i(0),
        }
    )
)

local for_loop_x = s(
    { trig = 'for(%a)', regTrig = true },
    fmt(
        [[for (int {var} = 0; {var} < {}; {var}++)]],
        {
            var = f(function(_, snip)
                return snip.captures[1]
            end),
            i(0),
        },
        {
            repeat_duplicates = true,
        }
    )
)

local main_function = s(
    'main',
    fmta(
        [[public static void main(String[] args) {
   <>
}]],
        { i(0) }
    )
)

local println = s('println', fmta('System.out.println(<>)', { i(0) }))

local algs4 = s('import algs', t('import edu.princeton.cs.algs4.'))

local snippets = {
    for_loop_x,
}
local autosnippets = {
    main_class,
    main_function,
    println,
    algs4,
}

return snippets, autosnippets
