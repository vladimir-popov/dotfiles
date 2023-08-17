local main = s(
    'main',
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

local algs4 = s('import algs', t('import edu.princeton.cs.algs4.'))

local snippets = {}
local autosnippets = {
    main,
    algs4,
}

return snippets, autosnippets
