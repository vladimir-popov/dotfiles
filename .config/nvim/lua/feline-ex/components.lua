local p = require('feline-ex.providers')
local i = require('feline-ex.icons')
local c = require('feline-ex.conditions')
local h = require('feline-ex.highlights')

local M = {}

---The name of the current file relative to the current working directory.
---If file is not in the one of subdirectories of the working directory, then its
---path will be returned with:
--- * prefix "/.../" in case when the file is not in the one of home subdirectories;
--- * prefix "~/" in case when the file is in one of home subdirectories.
---
---@type Component
M.relative_file_name = {
    provider = p.relative_file_name,
    short_provider = p.file_name,
    enabled = c.is_buffer_not_empty,
}

---The name of the current git branch. This component uses 'tpope/vim-fugitive'
---plugin to take info about git workspace.
---
---@type Component
M.git_branch = {
    provider = p.fugitive_branch,
    icon = i.git_icon,
    hl = h.git_status,
}

---The last N directories of the current working directory path. Count of directories
---can be customized.
---
---Custom properties:
--- * `hls` should have custom highlights for vi modes.
---The keys of this table are names of the vi mode according to
---`'feline.providers.vi_mode'.get_mode_highlight_name`.
---
--- * `opts` can have a property 'length' with count of directories in the path.
---
---@type Component
M.working_directory = {
    provider = p.working_path,
}

---Returns a list of languages used for spellchecking. If spellchecking is off and component
---doesn't have an icon, then only string '暈' will be returned. But, if component has an icon,
---then it behave as usually: shows a list of langs with icon when spellchecking is on, and it's
---hide when spellchecking is off.
---Example: '暈en' for english spellcheck, or just '暈' when spellchecking is off.
---
---@type Component
M.spellcheck = {
    provider = p.spellcheck_langs,
    icon = i.spellcheck_icon,
}

return M
