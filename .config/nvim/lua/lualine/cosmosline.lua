return {
    options = {
        always_divide_middle = true,
        globalstatus = true,
        component_separators = { left = '%#lualine_a_normal#|', right = '%#lualine_a_normal#|' },
        section_separators = { left = ' ', right = ' ' },
        theme = 'cosmosline',
    },
    sections = {
        lualine_a = { { '%{"▊"}', separator = '', padding = 0 }, { 'ex.cwd', padding = 0 } },
        lualine_b = { { 'ex.relative_filename', padding = 0 } },
        lualine_c = { '%=This is a text message' },
        lualine_x = {'ex.git.branch'},
        lualine_y = {
            'diagnostics',
            { 'ex.lsp', icons_only = true, icons = { spellcheck = { '暈', color = 'purple' } } },
            'location',
        },
        lualine_z = { 'progress' },
    },
    inactive_sections = {
        lualine_a = { 'mode' },
        lualine_b = { 'filename' },
    },
}
