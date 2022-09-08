local h = require('feline-ex.highlights')
local u = require('feline-ex.utils')

local M = {}

M.file_status_icon = {
    provider = function(c)
        return (vim.bo.readonly and c.readonly_icon) or (vim.bo.modified and c.modified_icon) or ''
    end,
    hl = h.file_status,
    readonly_icon = '  ',
    modified_icon = '  ',
}

---Returns an icon symbolizing state of the spellchecking.
---When spellchecking is on, the icon will have `hls.active` color.
---When spellchecking is off, the icon will have `hls.inactive` color.
M.spellcheck_icon = {
    provider = function(cmp)
        return cmp and cmp.icon_symbol
    end,
    hl = h.spellcheck,
    icon_symbol = '暈',
    hls = {
        active = 'fg',
        inactive = 'grey',
    },
}

M.git_icon = {
    provider = function(cmp)
        return cmp and cmp.icon_symbol
    end,
    hl = h.git_status,
    icon_symbol = ' ',
    hls = {
        inactive = { fg = 'grey' },
        changed = { fg = 'orange' },
        commited = { fg = 'green' },
    },
}

M.treesitter_parser_icon = {
    provider = function(cmp)
        return cmp and cmp.icon_symbol
    end,
    hl = h.treesitter_parser,
    icon_symbol = '  ',
    hls = {
        active = { fg = 'green' },
        inactive = { fg = 'grey' },
    },
}

return M
