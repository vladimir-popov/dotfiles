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

local snippets = {}
local autosnippets = {
    main_class,
    main_function,
    println,
    algs4,
}

return snippets, autosnippets
