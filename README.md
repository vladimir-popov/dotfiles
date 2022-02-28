# dotfiles

_This is a prompt directly to me_

To apply dotfiles to a new machine:

1. Install git
```sh
$ brew install git
```

2. In the new sh session create alias:
```sh
$ alias dot='git --git-dir=$HOME/.git_dot/ --work-tree=$HOME'
```

3. Clone this repo:
```sh 
$ git clone --bare git@github.com:vladimir-popov/dotfiles.git $HOME/.git_dot
```

4. Checkout repo to the $HOME directory:
```sh
$ cd ~
$ dot checkout
```

5. Set the flag showUntrackedFiles to no on this specific (local) repository:
```sh
$ config config --local status.showUntrackedFiles no
```

_Thanks Atlassian for the advice https://www.atlassian.com/git/tutorials/dotfiles_
