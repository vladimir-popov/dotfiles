local colors = {
    fg = '#abb2bf',
    bg = '#3c3c41',
    alpha = 'NONE',
    inactive = '#5c6370',
    insert = '#79a15c',
    command = '#e5c07b',
    visual = '#c678dd',
    normal = '#61afef',
    replace = '#d3869b',
}

return {
    normal = {
        a = { bg = colors.bg, fg = colors.normal },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },

        x = { bg = colors.alpha, fg = 'green' },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.normal },
    },
    insert = {
        a = { bg = colors.bg, fg = colors.insert },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },

        x = { bg = colors.alpha, fg = colors.inactive },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.insert },
    },
    visual = {
        a = { bg = colors.bg, fg = colors.visual },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },

        x = { bg = colors.alpha, fg = colors.inactive },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.visual },
    },
    replace = {
        a = { bg = colors.bg, fg = colors.replace },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },

        x = { bg = colors.alpha, fg = colors.inactive },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.replace },
    },
    command = {
        a = { bg = colors.bg, fg = colors.command },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },

        x = { bg = colors.alpha, fg = colors.inactive },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.command },
    },
    inactive = {
        a = { bg = colors.bg, fg = colors.inactive },
        b = { bg = colors.bg, fg = colors.fg },
        c = { bg = colors.alpha, fg = colors.inactive },

        x = { bg = colors.alpha, fg = colors.inactive },
        y = { bg = colors.bg, fg = colors.fg },
        z = { bg = colors.bg, fg = colors.inactive },
    },
}
