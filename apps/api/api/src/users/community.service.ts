Id) {
      await this.storyViews.createQueryBuilder().insert()
        .values({ storyId, viewerId }).orIgnore().execute();
    }
    return { viewed: true, viewsCount: await this.storyViews.count({ where: { storyId } }) };
  }

  async toggleLike(userId: string, postId: string, liked: boolean) {
    const post = await this.posts.findOne({ where: { id: postId, status: 'active' } });
    if (!post) throw new NotFoundException('Post topilmadi');
    if (liked) {
      await this.likes.createQueryBuilder().insert().values({ postId, userId }).orIgnore().execute();
    } else {
      await this.likes.delete({ postId, userId });
    }
    return { isLiked: liked, likesCount: await this.likes.count({ where: { postId } }) };
  }

  async listComments(postId: string) {
    const postExists = await this.posts.exists({ where: { id: postId, status: 'active' } });
    if (!postExists) throw new NotFoundException('Post topilmadi');
    const comments = await this.comments.find({
      where: { postId }, relations: { author: true }, order: { createdAt: 'ASC' }, take: 100,
    });
    return comments.filter((item) => item.author?.status === 'active').map((item) => ({
      id: item.id, content: item.content, createdAt: item.createdAt, author: this.safePerson(item.author),
    }));
  }

  async addComment(authorId: string, postId: string, rawContent: string) {
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content) throw new BadRequestException('Izoh matnini kiriting');
    if (content.length > 1000) throw new BadRequestException('Izoh 1000 belgidan oshmasin');
    const post = await this.posts.findOne({ where: { id: postId, status: 'active' } });
    if (!post) throw new NotFoundException('Post topilmadi');
    const author = await this.users.findOne({ where: { id: authorId, status: 'active' } });
    if (!author) throw new NotFoundException('Foydalanuvchi topilmadi');
    const comment = await this.comments.save(this.comments.create({ postId, authorId, content }));
    return { id: comment.id, content: comment.content, createdAt: comment.createdAt, author: this.safePerson(author) };
  }
}
