local h = require('feline-ex.highlights')

return {
    active = {
        left = {
            separators = { right = { str = ' ', hl = { fg = 'bg', bg = 'NONE' } } },
            a = { hl = h.vi_mode },
            b = { hl = { fg = 'fg', bg = 'bg' } },
        },
        middle = {
            a = { fg = 'bg', bg = 'NONE' },
        },
        right = {
            separators = { left = { str = ' ', hl = { fg = 'bg', bg = 'NONE' } } },
            u = {
                hl = { fg = 'fg', bg = 'bg' },
                separators = { right = { str = ' | ', hl = { fg = 'blue' } } },
            },
            v = {
                hl = { fg = 'fg', bg = 'bg' },
                separators = { right = { str = ' | ', hl = { fg = 'blue' } } },
            },
            w = {
                hl = { fg = 'fg', bg = 'bg' },
                separators = { right = { str = ' | ', hl = { fg = 'blue' } } },
            },
            x = {
                hl = { fg = 'fg', bg = 'bg' },
                separators = { right = { str = ' | ', hl = { fg = 'blue' } } },
            },
            y = {
                hl = { fg = 'fg', bg = 'bg' },
                separators = { right = { str = ' | ', hl = { fg = 'blue' } } },
            },
            z = { hl = h.vi_mode },
        },
    },

    inactive = {
        left = { a = { fg = 'fg', bg = 'bg' } },
    },

    vi_mode = {
        NORMAL = 'blue',
        OP = 'magenta',
        INSERT = 'green',
        VISUAL = 'magenta',
        LINES = 'magenta',
        BLOCK = 'magenta',
        REPLACE = 'violet',
        ['V-REPLACE'] = 'pink',
        ENTER = 'cyan',
        MORE = 'cyan',
        SELECT = 'yellow',
        COMMAND = 'orange',
        SHELL = 'yellow',
        TERM = 'orange',
        NONE = 'yellow',
    },

}
