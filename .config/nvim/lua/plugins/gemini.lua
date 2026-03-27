return {
    'kiddos/gemini.nvim',
    dev = true,
    event = "VeryLazy",
    opts = {
        hints = {
            enabled = true
        },
        completion = {
            enabled = false
        },
        instruction = {
            enabled = true
        },
        chat_config = {
            window = {
                position = "right",
                width = 80,
            }
        }
    },
    keys = {
        {
            '<space>gm',
            ':GeminiChat ',
            desc = 'Start chat with Gemini',
        },
    }
}
