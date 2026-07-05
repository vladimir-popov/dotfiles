local required_parsers =
{ 'bash', 'go', 'lua', 'luadoc', 'vim', 'vimdoc', 'scala', 'c', 'cpp',
    'java', 'proto', 'python', 'markdown', 'zig', 'html', 'yaml', }
return {
    'romus204/tree-sitter-manager.nvim',
    ft = required_parsers,
    config = function()
        require("tree-sitter-manager").setup({
            ensure_installed = required_parsers,
            auto_install = false,
        })
    end,
}
