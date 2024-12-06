async function removePost(userId, postId) {
    const permissions = await fetchPermissions(userId);
    const post = await fetchPost(postId);

    if(permissions.can('remove post') === false) {
        throw new Error('Not enough permissions!');
    }

    await sendRemoveRequest(post);
}
