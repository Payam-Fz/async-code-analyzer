async function removePost(userId, postId) {
    let permissions;
    let myVar = 1
    if (postId > 10) {
        permissions = await fetchPermissions(permissions);
        let irrelevant = 1;
    } else {
        permissions = await fetchRequirements(userId, 10);
    }
    const post = await fetchPost(postId);

    if(permissions.can('remove post') === false) {
        throw new Error('Not enough permissions!');
    }

    permissions++;

    let allPosts = [];
    for (let i=0; i<10; i++) {
        allPosts = [...allposts, await fetchPost(i)];
    }

    await sendRemoveRequest(post);
}
