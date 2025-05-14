-- Lightweight yet powerful formatter plugin for Neovim
return {
    "stevearc/conform.nvim",
    ft = { "lua", "json" },
    opts = {
        formatters_by_ft = {
            lua = { "stylua" },
            json = { "jq" },
        },
    },
    keys = {
        {
            '<leader>f',
            '<cmd>lua require("conform").format()<CR>',
            desc = 'Format the buffer by the conform.nvim',
        },
    }
}
