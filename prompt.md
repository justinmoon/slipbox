~/code/slipbox is a personal web aapp i'm making

~/configs/hetzner is a self-hosted runner that also serves prod app.

look at the github actions for slipbox. when ci passes, it should deploy
to the slipbox service on the same machine. there are some hacks in there.
could you audit this deployment feature and make recommendations for improving
it? 

please make me a plan to do this deploy "the nix way". i imagine we should
have a nix derivation for slipbox app itself, we should copy this into the
nix store on the hetzner machine, and some kind of watcher should be watching
for this and switch to the new derivation.

i want to have this machine do ci and
deployment for like a dozen different small projects over time so i don't
mind kinda over-engineering this b/c it's going to be quite a load-bearing
system for me in the future. i want it to wkr really well. the other option
is dockerizing everything but this is a little more appealing b/c it's
simpler.

the thing that's feels wrong right now is that we're copying files around and
not going through the nix store. imo the build we do during the ci run should
build it into the nix store and then we should just switch the machine to that
build.

make me a plan


