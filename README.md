# Dotfiles


## Preparation

Some dotfiles need additional tools and preparations. Before applying dotfiles some additional tools must be installed:

### Git

```sh
brew install git
```

### Oh My Zsh

```sh
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### Nerd fonts

```sh
brew tap homebrew/cask-fonts
brew install --cask font-fira-code-nerd-font
```

### Plugins manager for Vim

```sh
curl -fLo ~/.vim/autoload/plug.vim --create-dirs \
    https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
```

### Tmux

```sh
brew install tmux
```

To reattach process (e.g., tmux) to background, the follow should be installed:
```sh
brew install reattach-to-user-namespace
```

### Alacritty

```sh
brew install --cask alacritty
```

## Apply dotfiles 

To apply dotfiles to a new machine:

1. In the new sh session create alias:
```sh
alias dot='git --git-dir=$HOME/.git_dot/ --work-tree=$HOME'
```

2. Clone this repo:
```sh 
git clone --bare git@github.com:vladimir-popov/dotfiles.git $HOME/.git_dot
```

3. Checkout repo to the $HOME directory:
```sh
cd ~
dot checkout
```

4. Set the flag showUntrackedFiles to no on this specific (local) repository:
```sh
dot config --local status.showUntrackedFiles no
```

_Thanks Atlassian for the advice https://www.atlassian.com/git/tutorials/dotfiles_
